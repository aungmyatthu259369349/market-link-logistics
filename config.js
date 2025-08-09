module.exports = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'marketlink_logistics_secret_key_2024',
    DB_PATH: process.env.DB_PATH || './database/logistics.db',
    SESSION_SECRET: process.env.SESSION_SECRET || 'logistics_session_secret',
    ADMIN: {
        USERNAME: process.env.ADMIN_USERNAME || 'admin',
        PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
        EMAIL: process.env.ADMIN_EMAIL || 'admin@marketlinklogistics.com'
    }
}; 