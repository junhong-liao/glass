#!/usr/bin/env node

/**
 * Migration script to rename pickleglass.db to subliminal.db
 * This script safely migrates the existing database files
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { app } = require('electron');

// Determine paths based on app environment
function getDatabasePaths() {
    const userDataPath = app ? app.getPath('userData') : path.join(os.homedir(), 'Library/Application Support/Subliminal');
    const glassDataPath = path.join(os.homedir(), 'Library/Application Support/Glass');
    
    return {
        // Current subliminal path (where new DB should be)
        newDbPath: path.join(userDataPath, 'subliminal.db'),
        
        // Legacy paths that might contain pickleglass.db
        legacyPaths: [
            path.join(glassDataPath, 'pickleglass.db'),
            path.join(userDataPath, 'pickleglass.db')
        ]
    };
}

function createBackup(sourcePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${sourcePath}.backup-${timestamp}`;
    
    try {
        fs.copyFileSync(sourcePath, backupPath);
        console.log(`✅ Backup created: ${backupPath}`);
        return backupPath;
    } catch (error) {
        console.error(`❌ Failed to create backup: ${error.message}`);
        throw error;
    }
}

function migrateDatabase() {
    console.log('🔄 Starting database migration from pickleglass.db to subliminal.db');
    
    const paths = getDatabasePaths();
    
    // Check if new database already exists
    if (fs.existsSync(paths.newDbPath)) {
        console.log(`✅ subliminal.db already exists at: ${paths.newDbPath}`);
        return;
    }
    
    // Find the legacy database
    let legacyDbPath = null;
    for (const legacyPath of paths.legacyPaths) {
        if (fs.existsSync(legacyPath)) {
            legacyDbPath = legacyPath;
            console.log(`📦 Found legacy database: ${legacyPath}`);
            break;
        }
    }
    
    if (!legacyDbPath) {
        console.log('ℹ️  No legacy pickleglass.db found. Starting fresh with subliminal.db');
        return;
    }
    
    try {
        // Create backup
        createBackup(legacyDbPath);
        
        // Ensure target directory exists
        const targetDir = path.dirname(paths.newDbPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`📁 Created directory: ${targetDir}`);
        }
        
        // Copy to new location
        fs.copyFileSync(legacyDbPath, paths.newDbPath);
        console.log(`✅ Migrated database to: ${paths.newDbPath}`);
        
        // Verify the migration
        const originalSize = fs.statSync(legacyDbPath).size;
        const newSize = fs.statSync(paths.newDbPath).size;
        
        if (originalSize === newSize) {
            console.log(`✅ Migration verified (${originalSize} bytes)`);
            console.log('🎉 Database migration completed successfully!');
        } else {
            throw new Error(`Size mismatch: original=${originalSize}, new=${newSize}`);
        }
        
    } catch (error) {
        console.error(`❌ Migration failed: ${error.message}`);
        
        // Clean up failed migration
        if (fs.existsSync(paths.newDbPath)) {
            fs.unlinkSync(paths.newDbPath);
            console.log('🧹 Cleaned up incomplete migration');
        }
        
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    try {
        migrateDatabase();
    } catch (error) {
        console.error('💥 Migration script failed:', error.message);
        process.exit(1);
    }
}

module.exports = { migrateDatabase, getDatabasePaths };