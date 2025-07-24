const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class CLIInstallationService {
    constructor() {
        // More reliable way to get project root
        this.appDirectory = path.resolve(__dirname, '../../..'); // Go up to project root
        this.launcherScriptPath = path.join(this.appDirectory, 'subliminal');
        this.preferredBinDir = path.join(os.homedir(), '.local', 'bin');
        this.fallbackBinDir = '/usr/local/bin';
    }

    /**
     * Check if CLI command is currently installed
     * @returns {Promise<string>} 'installed' | 'not-installed' | 'error'
     */
    async checkInstallationStatus() {
        try {
            console.log('[CLIInstallationService] Checking installation status...');
            console.log('[CLIInstallationService] App directory:', this.appDirectory);
            console.log('[CLIInstallationService] Launcher script path:', this.launcherScriptPath);
            
            // Check if launcher script exists
            if (!fs.existsSync(this.launcherScriptPath)) {
                console.log('[CLIInstallationService] Launcher script does not exist');
                return 'not-installed';
            }

            // Check if symlink exists in preferred location
            const preferredSymlink = path.join(this.preferredBinDir, 'subliminal');
            if (fs.existsSync(preferredSymlink) && fs.lstatSync(preferredSymlink).isSymbolicLink()) {
                return 'installed';
            }

            // Check fallback location
            const fallbackSymlink = path.join(this.fallbackBinDir, 'subliminal');
            if (fs.existsSync(fallbackSymlink) && fs.lstatSync(fallbackSymlink).isSymbolicLink()) {
                return 'installed';
            }

            return 'not-installed';
        } catch (error) {
            console.error('[CLIInstallationService] Error checking installation status:', error);
            return 'error';
        }
    }

    /**
     * Install CLI command
     * @returns {Promise<{success: boolean, error?: string, message?: string}>}
     */
    async installCLI() {
        try {
            console.log('[CLIInstallationService] Starting CLI installation...');
            console.log('[CLIInstallationService] App directory:', this.appDirectory);
            console.log('[CLIInstallationService] Launcher script path:', this.launcherScriptPath);

            // Step 1: Create launcher script
            const scriptCreated = await this.createLauncherScript();
            if (!scriptCreated.success) {
                return scriptCreated;
            }

            // Step 2: Ensure bin directory exists
            const binDirResult = await this.ensureBinDirectory();
            if (!binDirResult.success) {
                return binDirResult;
            }

            // Step 3: Create symlink
            const symlinkResult = await this.createSymlink(binDirResult.binDir);
            if (!symlinkResult.success) {
                return symlinkResult;
            }

            // Step 4: Ensure directory is in PATH
            const pathResult = await this.ensureDirectoryInPath(binDirResult.binDir);
            if (!pathResult.success) {
                console.warn('[CLIInstallationService] PATH update failed, but symlink created:', pathResult.error);
                // Don't fail installation if PATH update fails
            }

            console.log('[CLIInstallationService] CLI installation completed successfully');
            return {
                success: true,
                message: 'CLI command "subliminal" installed successfully'
            };

        } catch (error) {
            console.error('[CLIInstallationService] Error during CLI installation:', error);
            return {
                success: false,
                error: `Installation failed: ${error.message}`
            };
        }
    }

    /**
     * Uninstall CLI command
     * @returns {Promise<{success: boolean, error?: string, message?: string}>}
     */
    async uninstallCLI() {
        try {
            console.log('[CLIInstallationService] Starting CLI uninstallation...');

            let removed = false;

            // Remove symlink from preferred location
            const preferredSymlink = path.join(this.preferredBinDir, 'subliminal');
            if (fs.existsSync(preferredSymlink)) {
                fs.unlinkSync(preferredSymlink);
                removed = true;
                console.log('[CLIInstallationService] Removed symlink from:', preferredSymlink);
            }

            // Remove symlink from fallback location
            const fallbackSymlink = path.join(this.fallbackBinDir, 'subliminal');
            if (fs.existsSync(fallbackSymlink)) {
                try {
                    execSync(`sudo rm -f "${fallbackSymlink}"`, { stdio: 'pipe' });
                    removed = true;
                    console.log('[CLIInstallationService] Removed symlink from:', fallbackSymlink);
                } catch (error) {
                    console.warn('[CLIInstallationService] Could not remove fallback symlink:', error.message);
                }
            }

            // Remove launcher script
            if (fs.existsSync(this.launcherScriptPath)) {
                fs.unlinkSync(this.launcherScriptPath);
                console.log('[CLIInstallationService] Removed launcher script');
            }

            return {
                success: true,
                message: removed ? 'CLI command uninstalled successfully' : 'CLI command was not installed'
            };

        } catch (error) {
            console.error('[CLIInstallationService] Error during CLI uninstallation:', error);
            return {
                success: false,
                error: `Uninstallation failed: ${error.message}`
            };
        }
    }

    /**
     * Create the launcher script
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async createLauncherScript() {
        try {
            const scriptContent = `#!/bin/bash

# Subliminal AI - CLI Launcher
# This script allows you to launch Subliminal from anywhere by typing 'subliminal'

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

# Get the directory where this script is located (or the original if this is a symlink)
if [ -L "\${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$(readlink "\${BASH_SOURCE[0]}")")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
fi

echo -e "\${GREEN}Subliminal AI\${NC}"

# Change to the project directory
cd "$SCRIPT_DIR"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "\${RED}Error: Could not find package.json. Make sure this script is in the Subliminal project root.\${NC}"
    exit 1
fi

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "\${RED}Error: Node.js is not installed. Please install Node.js first.\${NC}"
    exit 1
fi

# Check for npm
if ! command -v npm >/dev/null 2>&1; then
    echo -e "\${RED}Error: npm is not installed. Please install npm first.\${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "\${YELLOW}Installing dependencies...\${NC}"
    npm install
fi

# Launch the application
echo -e "\${GREEN}Starting Subliminal AI...\${NC}"
npm start
`;

            fs.writeFileSync(this.launcherScriptPath, scriptContent, { mode: 0o755 });
            console.log('[CLIInstallationService] Launcher script created at:', this.launcherScriptPath);

            return { success: true };
        } catch (error) {
            console.error('[CLIInstallationService] Error creating launcher script:', error);
            return {
                success: false,
                error: `Failed to create launcher script: ${error.message}`
            };
        }
    }

    /**
     * Ensure bin directory exists and determine which one to use
     * @returns {Promise<{success: boolean, binDir?: string, error?: string}>}
     */
    async ensureBinDirectory() {
        try {
            // Try preferred directory first
            if (!fs.existsSync(this.preferredBinDir)) {
                fs.mkdirSync(this.preferredBinDir, { recursive: true });
                console.log('[CLIInstallationService] Created directory:', this.preferredBinDir);
            }

            // Check if we can write to preferred directory
            try {
                const testFile = path.join(this.preferredBinDir, '.test-write');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                return { success: true, binDir: this.preferredBinDir };
            } catch (error) {
                console.warn('[CLIInstallationService] Cannot write to preferred directory:', error.message);
            }

            // Fallback to system directory
            if (fs.existsSync(this.fallbackBinDir)) {
                try {
                    const testFile = path.join(this.fallbackBinDir, '.test-write');
                    execSync(`sudo touch "${testFile}" && sudo rm -f "${testFile}"`, { stdio: 'pipe' });
                    return { success: true, binDir: this.fallbackBinDir };
                } catch (error) {
                    console.warn('[CLIInstallationService] Cannot write to fallback directory:', error.message);
                }
            }

            return {
                success: false,
                error: 'Cannot find writable directory for CLI installation'
            };

        } catch (error) {
            console.error('[CLIInstallationService] Error ensuring bin directory:', error);
            return {
                success: false,
                error: `Failed to create bin directory: ${error.message}`
            };
        }
    }

    /**
     * Create symlink to the launcher script
     * @param {string} binDir - Directory to create symlink in
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async createSymlink(binDir) {
        try {
            const symlinkPath = path.join(binDir, 'subliminal');

            // Remove existing symlink if it exists
            if (fs.existsSync(symlinkPath)) {
                if (binDir === this.fallbackBinDir) {
                    execSync(`sudo rm -f "${symlinkPath}"`, { stdio: 'pipe' });
                } else {
                    fs.unlinkSync(symlinkPath);
                }
                console.log('[CLIInstallationService] Removed existing symlink');
            }

            // Create new symlink
            if (binDir === this.fallbackBinDir) {
                execSync(`sudo ln -s "${this.launcherScriptPath}" "${symlinkPath}"`, { stdio: 'pipe' });
            } else {
                fs.symlinkSync(this.launcherScriptPath, symlinkPath);
            }

            console.log('[CLIInstallationService] Created symlink:', symlinkPath);
            return { success: true };

        } catch (error) {
            console.error('[CLIInstallationService] Error creating symlink:', error);
            return {
                success: false,
                error: `Failed to create symlink: ${error.message}`
            };
        }
    }

    /**
     * Ensure directory is in PATH by updating shell configuration
     * @param {string} binDir - Directory to add to PATH
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async ensureDirectoryInPath(binDir) {
        try {
            // Check if directory is already in PATH
            const currentPath = process.env.PATH || '';
            if (currentPath.includes(binDir)) {
                console.log('[CLIInstallationService] Directory already in PATH:', binDir);
                return { success: true };
            }

            // Determine shell configuration file
            const homeDir = os.homedir();
            let shellConfigFile = null;

            // Check for zsh (default on macOS Catalina+)
            const zshrcPath = path.join(homeDir, '.zshrc');
            if (fs.existsSync(zshrcPath) || process.env.SHELL?.includes('zsh')) {
                shellConfigFile = zshrcPath;
            } else {
                // Fallback to bash
                const bashProfilePath = path.join(homeDir, '.bash_profile');
                const bashrcPath = path.join(homeDir, '.bashrc');
                shellConfigFile = fs.existsSync(bashProfilePath) ? bashProfilePath : bashrcPath;
            }

            if (!shellConfigFile) {
                return {
                    success: false,
                    error: 'Could not determine shell configuration file'
                };
            }

            // Read existing content
            let content = '';
            if (fs.existsSync(shellConfigFile)) {
                content = fs.readFileSync(shellConfigFile, 'utf8');
            }

            // Check if PATH export already exists
            const pathExportPattern = new RegExp(`export\\s+PATH=.*${binDir.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`);
            if (pathExportPattern.test(content)) {
                console.log('[CLIInstallationService] PATH export already exists in:', shellConfigFile);
                return { success: true };
            }

            // Add PATH export
            const pathExport = `\n# Added by Subliminal AI installer\nexport PATH="${binDir}:$PATH"\n`;
            content += pathExport;

            fs.writeFileSync(shellConfigFile, content);
            console.log('[CLIInstallationService] Added PATH export to:', shellConfigFile);

            return { success: true };

        } catch (error) {
            console.error('[CLIInstallationService] Error updating PATH:', error);
            return {
                success: false,
                error: `Failed to update PATH: ${error.message}`
            };
        }
    }
}

module.exports = CLIInstallationService;