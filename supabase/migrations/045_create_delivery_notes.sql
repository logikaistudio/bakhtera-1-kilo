-- Create freight_delivery_notes table for Surat Jalan
-- Migration: 045_create_delivery_notes.sql

CREATE TABLE IF NOT EXISTS freight_delivery_notes (
    id TEXT PRIMARY KEY,
    delivery_note_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    destination TEXT,
    
    -- Shipping Information
    consignee TEXT,
    seal_number TEXT,
    truck_number TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    
    -- Reference to source documents
    pengajuan_id TEXT REFERENCES freight_quotations(id),
    mutation_log_id TEXT,
    bc_document_number TEXT,
    
    -- Items (JSONB array)
    items JSONB,
    
    -- Status & Workflow
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received')),
    
    -- Sender Information
    sender_name TEXT,
    sender_position TEXT,
    sender_signature TEXT,
    
    -- Receiver Information (filled when status = received)
    receiver_name TEXT,
    receiver_company TEXT,
    receiver_signature TEXT,
    received_date DATE,
    received_confirmation BOOLEAN DEFAULT false,
    
    -- Notes
    remarks TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_notes_number ON freight_delivery_notes(delivery_note_number);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date ON freight_delivery_notes(date);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON freight_delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_pengajuan ON freight_delivery_notes(pengajuan_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_destination ON freight_delivery_notes(destination);

-- Add comments
COMMENT ON TABLE freight_delivery_notes IS 'Surat Jalan - Delivery notes for goods shipment tracking';
COMMENT ON COLUMN freight_delivery_notes.delivery_note_number IS 'Unique delivery note number (format: SJ-XXX/MM/YYYY)';
COMMENT ON COLUMN freight_delivery_notes.status IS 'Delivery status: draft, sent, received';
COMMENT ON COLUMN freight_delivery_notes.items IS 'Array of items being delivered (JSONB)';
COMMENT ON COLUMN freight_delivery_notes.received_confirmation IS 'Checkbox: Barang telah diterima dengan lengkap dan baik';
