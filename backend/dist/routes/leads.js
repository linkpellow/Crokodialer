"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Contact_1 = __importDefault(require("../models/Contact"));
const router = (0, express_1.Router)();
// GET /api/leads - Get all leads
router.get('/', async (_req, res) => {
    try {
        console.log('📞 [LEADS] Fetching all contacts from database...');
        const contacts = await Contact_1.default.find({}).lean();
        console.log(`📞 [LEADS] Found ${contacts.length} contacts in database`);
        const leads = contacts.map((contact) => ({
            id: contact._id.toString(),
            name: contact.name || 'Unknown Lead',
            phone: contact.phoneNumber || '',
            email: contact.email || '',
            company: contact.company || '',
            status: 'new',
            createdAt: contact.createdAt || new Date(),
            updatedAt: contact.updatedAt || new Date()
        }));
        console.log(`📞 [LEADS] Returning ${leads.length} leads to frontend`);
        return res.json({ success: true, data: leads });
    }
    catch (error) {
        console.error('❌ [LEADS] Error fetching leads:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch leads',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// POST /api/leads - Create new lead
router.post('/', async (req, res) => {
    try {
        const { name, phone, email, company } = req.body;
        console.log('📞 [LEADS] Creating new lead:', { name, phone, email, company });
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone are required'
            });
        }
        const newContact = new Contact_1.default({
            name,
            phoneNumber: phone,
            email: email || '',
            company: company || ''
        });
        const savedContact = await newContact.save();
        console.log(`📞 [LEADS] Created new lead with ID: ${savedContact._id}`);
        return res.status(201).json({
            success: true,
            data: {
                id: savedContact._id.toString(),
                name: savedContact.name,
                phone: savedContact.phoneNumber,
                email: savedContact.email,
                company: savedContact.company,
                status: 'new',
                createdAt: savedContact.createdAt,
                updatedAt: savedContact.updatedAt
            },
            message: 'Lead created successfully'
        });
    }
    catch (error) {
        console.error('❌ [LEADS] Error creating lead:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create lead',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// GET /api/leads/:id - Get specific lead
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📞 [LEADS] Fetching lead with ID: ${id}`);
        const contact = await Contact_1.default.findById(id).lean();
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }
        const lead = {
            id: contact._id.toString(),
            name: contact.name || 'Unknown Lead',
            phone: contact.phoneNumber || '',
            email: contact.email || '',
            company: contact.company || '',
            status: 'new',
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt
        };
        return res.json({ success: true, data: lead });
    }
    catch (error) {
        console.error('❌ [LEADS] Error fetching lead:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch lead',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
