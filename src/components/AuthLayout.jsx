import './AuthLayout.css';

export default function AuthLayout({ children, quote, author }) {
    return (
        <div className="auth-container">
            <div className="auth-card">
                {/* Panoul din stânga - Verde */}
                <div className="auth-quote-panel">
                    <p className="quote-text">"{quote}"</p>
                    <p className="quote-author">— {author}</p>
                </div>

                {/* Panoul din dreapta - Alb */}
                <div className="auth-form-panel">
                    {children}
                </div>
            </div>
        </div>
    );
}