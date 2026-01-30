// fix_users.js
const Database = require('better-sqlite3');
const db = new Database('database.db');

console.log("🔄 Starting Username Migration...");

try {
    // 1. Get all users
    const users = db.prepare("SELECT id, username FROM users").all();
    let updatedCount = 0;

    const updateStmt = db.prepare("UPDATE users SET username = ? WHERE id = ?");

    // 2. Loop through every user
    for (const user of users) {
        const oldName = user.username;
        let newName = oldName.toLowerCase();

        // If name is already lowercase, skip
        if (oldName === newName) continue;

        try {
            // Try to update to lowercase
            updateStmt.run(newName, user.id);
            console.log(`✅ Fixed: '${oldName}' -> '${newName}'`);
            updatedCount++;
        } catch (err) {
            // 3. Handle Duplicates (Collision)
            // If "joy" already exists, rename "JOY" to "joy1"
            if (err.message.includes('UNIQUE constraint failed')) {
                newName = newName + '1';
                try {
                    updateStmt.run(newName, user.id);
                    console.log(`⚠️ Collision Resolved: '${oldName}' -> '${newName}'`);
                    updatedCount++;
                } catch (e) {
                    console.error(`❌ Failed to fix '${oldName}':`, e.message);
                }
            } else {
                console.error(`❌ Error updating '${oldName}':`, err.message);
            }
        }
    }

    console.log(`\n🎉 Migration Complete! Updated ${updatedCount} users.`);

} catch (err) {
    console.error("Critical Error:", err);
}