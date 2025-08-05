"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// In-memory theme storage (in production, this would be in a database)
let currentTheme = {
    backgroundColor: '#000000',
    textColor: '#ffffff',
    accentColor: '#007bff',
    borderColor: '#dee2e6',
    primaryColor: '#007bff',
    secondaryColor: '#6c757d'
};
// GET /api/ui-config - Get current theme configuration
router.get('/', async (_req, res) => {
    try {
        console.log('🎨 [UI-CONFIG] Theme requested');
        res.json({
            success: true,
            theme: currentTheme,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ [UI-CONFIG] Error getting theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get theme configuration'
        });
    }
});
// POST /api/ui-config - Update theme configuration
router.post('/', async (req, res) => {
    try {
        const { theme } = req.body;
        if (!theme) {
            res.status(400).json({
                success: false,
                message: 'Theme data is required'
            });
            return;
        }
        console.log('🎨 [UI-CONFIG] Theme update received:', theme);
        // Update current theme
        currentTheme = {
            ...currentTheme,
            ...theme
        };
        // Theme updated - clients can poll for changes or use webhooks
        console.log('📡 [UI-CONFIG] Theme updated, clients can fetch latest theme');
        res.json({
            success: true,
            theme: currentTheme,
            message: 'Theme updated successfully'
        });
    }
    catch (error) {
        console.error('❌ [UI-CONFIG] Error updating theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update theme configuration'
        });
    }
});
// GET /api/ui-config/health - Health check for theme service
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        message: 'UI Config service is running',
        currentTheme
    });
});
// POST /api/ui-config/test - Test endpoint to simulate theme changes
router.post('/test', async (req, res) => {
    try {
        const { themeName } = req.body;
        const testThemes = {
            'dark': {
                backgroundColor: '#1a1a1a',
                textColor: '#ffffff',
                accentColor: '#007bff',
                borderColor: '#333333',
                primaryColor: '#007bff',
                secondaryColor: '#6c757d'
            },
            'light': {
                backgroundColor: '#ffffff',
                textColor: '#000000',
                accentColor: '#007bff',
                borderColor: '#dee2e6',
                primaryColor: '#007bff',
                secondaryColor: '#6c757d'
            },
            'blue': {
                backgroundColor: '#2c3e50',
                textColor: '#ecf0f1',
                accentColor: '#3498db',
                borderColor: '#34495e',
                primaryColor: '#3498db',
                secondaryColor: '#95a5a6'
            },
            'green': {
                backgroundColor: '#27ae60',
                textColor: '#ffffff',
                accentColor: '#2ecc71',
                borderColor: '#229954',
                primaryColor: '#2ecc71',
                secondaryColor: '#95a5a6'
            },
            'red': {
                backgroundColor: '#e74c3c',
                textColor: '#ffffff',
                accentColor: '#c0392b',
                borderColor: '#c0392b',
                primaryColor: '#c0392b',
                secondaryColor: '#95a5a6'
            },
            'orange': {
                backgroundColor: '#f39c12',
                textColor: '#ffffff',
                accentColor: '#e67e22',
                borderColor: '#e67e22',
                primaryColor: '#e67e22',
                secondaryColor: '#95a5a6'
            }
        };
        const newTheme = testThemes[themeName] || testThemes['dark'];
        console.log(`🎨 [UI-CONFIG] Test theme change to: ${themeName}`);
        // Update current theme
        currentTheme = newTheme;
        // Test theme updated - clients can poll for changes
        console.log('📡 [UI-CONFIG] Test theme updated, clients can fetch latest theme');
        res.json({
            success: true,
            theme: currentTheme,
            message: `Theme changed to ${themeName}`,
            availableThemes: Object.keys(testThemes)
        });
    }
    catch (error) {
        console.error('❌ [UI-CONFIG] Error in test theme change:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change test theme'
        });
    }
});
exports.default = router;
