from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.database import session_scope
from app.models.activity_model import LogEntry, ObservationListEntry
from app.models.book_model import Book
from app.models.nexus_model import NexusEdge, NexusNode
from app.models.quote_card_model import QuoteCard
from app.models.user_model import PasswordResetToken, Permission, Role, SessionToken, User


class UserRepository:
    def create(self, user: User, role_name: str = "user") -> User:
        with session_scope() as session:
            if role_name:
                role = session.scalar(select(Role).where(Role.name == role_name))
                if role is not None:
                    user.roles.append(role)
                else:
                    role = Role(id=str(uuid4()), name=role_name, description=f"{role_name} role")
                    session.add(role)
                    user.roles.append(role)

            session.add(user)
            session.flush()
            user_id = user.id

        created = self.get_by_id(user_id)
        if created is None:
            raise RuntimeError("Failed to create user")
        return created

    def get_by_id(self, user_id: str) -> User | None:
        with session_scope() as session:
            return session.scalar(
                select(User)
                .where(User.id == user_id)
                .options(selectinload(User.roles).selectinload(Role.permissions))
            )

    def get_by_email(self, email: str) -> User | None:
        with session_scope() as session:
            return session.scalar(
                select(User)
                .where(User.email == email)
                .options(selectinload(User.roles).selectinload(Role.permissions))
            )

    def ensure_role(self, name: str, description: str = "") -> Role:
        with session_scope() as session:
            role = session.scalar(select(Role).where(Role.name == name))
            if role is None:
                role = Role(id=str(uuid4()), name=name, description=description)
                session.add(role)
            else:
                role.description = description or role.description
            session.flush()
            session.refresh(role)
            return role

    def ensure_permission(self, name: str, description: str = "") -> Permission:
        with session_scope() as session:
            permission = session.scalar(select(Permission).where(Permission.name == name))
            if permission is None:
                permission = Permission(id=str(uuid4()), name=name, description=description)
                session.add(permission)
            else:
                permission.description = description or permission.description
            session.flush()
            session.refresh(permission)
            return permission

    def assign_permission_to_role(self, role_name: str, permission_name: str) -> None:
        with session_scope() as session:
            role = session.scalar(
                select(Role)
                .where(Role.name == role_name)
                .options(selectinload(Role.permissions))
            )
            permission = session.scalar(select(Permission).where(Permission.name == permission_name))
            if role is None or permission is None:
                return
            if all(existing.id != permission.id for existing in role.permissions):
                role.permissions.append(permission)

    def assign_role_to_user(self, user_id: str, role_name: str) -> None:
        with session_scope() as session:
            user = session.scalar(
                select(User)
                .where(User.id == user_id)
                .options(selectinload(User.roles))
            )
            role = session.scalar(select(Role).where(Role.name == role_name))
            if user is None or role is None:
                return
            if all(existing.id != role.id for existing in user.roles):
                user.roles.append(role)

    def update_password_hash(self, user_id: str, password_hash: str) -> bool:
        with session_scope() as session:
            user = session.get(User, user_id)
            if user is None:
                return False
            user.password_hash = password_hash
            return True

    def ensure_user(
        self,
        *,
        name: str,
        email: str,
        password_hash: str,
        role_name: str,
    ) -> User:
        existing = self.get_by_email(email)
        if existing is not None:
            self.assign_role_to_user(existing.id, role_name)
            return self.get_by_id(existing.id) or existing

        return self.create(
            User(
                id=str(uuid4()),
                name=name,
                email=email,
                password_hash=password_hash,
            ),
            role_name=role_name,
        )

    def clear(self) -> None:
        with session_scope() as session:
            session.execute(delete(SessionToken))
            session.execute(delete(PasswordResetToken))
            session.execute(delete(LogEntry))
            session.execute(delete(ObservationListEntry))
            session.execute(delete(NexusEdge))
            session.execute(delete(NexusNode))
            session.execute(delete(QuoteCard))
            session.execute(delete(Book))
            session.execute(delete(User))
