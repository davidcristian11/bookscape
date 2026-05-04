import { Link } from 'react-router-dom';
import { motion } from 'framer-motion'; // 1. Importăm motion
import './WelcomePage.css';

export default function WelcomePage() {
    const bookAngles = [0, 45, 90, 135, 180, 225, 270, 315];

    return (
        <div className="welcome-container">

            {/* 2. Schimbăm <div> în <motion.div> pentru partea stângă */}
            <motion.div
                className="welcome-text-section"
                initial={{ opacity: 0, x: -50 }} // Pleacă invizibil din stânga
                animate={{ opacity: 1, x: 0 }}   // Ajunge vizibil la locul lui
                transition={{ duration: 0.8 }}   // Durează 0.8 secunde
            >
                <h1 className="welcome-title">Curate your digital library.</h1>
                <p className="welcome-description">
                    Instantly scrape book data from around the web, write comprehensive reviews,
                    and organize your reading list in one minimalist space.
                </p>
                <Link to="/register" className="start-btn">
                    Start Scraping Now
                </Link>
            </motion.div>

            {/* 3. Animăm partea dreaptă să vină dinspre dreapta */}
            <motion.div
                className="welcome-visual-section"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }} // Pornește puțin mai târziu
            >
                <div className="center-circle">
                    Scrape the World
                </div>

                {bookAngles.map((angle, index) => (
                    <div
                        key={index}
                        className="orbiting-book"
                        style={{ transform: `rotate(${angle}deg) translateY(-180px)` }}
                    ></div>
                ))}
            </motion.div>

        </div>
    );
}