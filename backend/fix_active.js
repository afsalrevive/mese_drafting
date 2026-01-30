const Database = require('better-sqlite3');
const db = new Database('database.db');

try {
    // 1. Add isActive column (Default to 1 = Active)
    db.prepare("ALTER TABLE users ADD COLUMN isActive INTEGER DEFAULT 1").run();
    console.log("✅ Added 'isActive' column.");
} catch (e) {
    if(e.message.includes('duplicate column')) console.log("ℹ️ 'isActive' column already exists.");
    else console.error("Error:", e.message);
}

// 2. Ensure all existing users are set to Active (1)
db.prepare("UPDATE users SET isActive = 1 WHERE isActive IS NULL").run();
console.log("✅ All existing users marked as Active.");