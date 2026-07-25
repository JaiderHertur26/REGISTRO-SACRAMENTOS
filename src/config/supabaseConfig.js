// supabaseConfig.js
// Central configuration for Supabase integration
// Single Source of Truth for tables, roles and schema contracts

/* =========================================================
   TABLE NAMES
   ========================================================= */

export const TABLE_NAMES = Object.freeze({
    DIOCESES: 'dioceses',
    VICARIAS: 'vicarias',
    DECANATOS: 'decanatos',
    PARISHES: 'parishes',
    USERS: 'users',
    SACRAMENT_RECORDS: 'sacrament_records',
    BAPTISMS: 'baptisms',
    CATALOGS: 'catalogs'
});

/* =========================================================
   ROLE TYPES
   Defines the four REAL roles in the system hierarchy.
   
   HIERARCHY & PERMISSIONS:
   1. ADMIN_GENERAL ('admin_general'): 
      - System-wide superadmin
      - Can manage Dioceses/Archdioceses
      - Can access all settings
      - Can manage global users
   
   2. DIOCESE ('diocese'):
      - Diocese-level administrator
      - Manages its own ecclesiastical structure (Vicariates, Deaneries, Parishes)
      - Manages its own Chancery and Parish users
      - View-only access to global settings
   
   3. CHANCERY ('chancery'):
      - Department-level role within a Diocese
      - Manages sacramental documents, certifications, and approvals
      - Handles communications
      - No permission to alter ecclesiastical structure
   
   4. PARISH ('parish'):
      - Parish-level operational role
      - Manages sacraments (Baptism, Confirmation, Marriage)
      - Issues certificates
      - Manages local parish settings and books
   ========================================================= */

export const ROLE_TYPES = Object.freeze({
    ADMIN_GENERAL: 'admin_general',
    DIOCESE: 'diocese',
    CHANCERY: 'chancery',
    PARISH: 'parish'
});

/* =========================================================
   SCHEMA STRUCTURE
   Frontend contract for validation, imports and UI logic
   ========================================================= */

export const SCHEMA_STRUCTURE = Object.freeze({
    dioceses: {
        fields: [
            'id',
            'name',
            'type',
            'bishop_name',
            'address',
            'phone',
            'email',
            'website',
            'created_at',
            'updated_at'
        ]
    },

    vicarias: {
        fields: [
            'id',
            'diocese_id',
            'name',
            'vicar_name',
            'created_at'
        ]
    },

    decanatos: {
        fields: [
            'id',
            'vicaria_id',
            'name',
            'dean_name',
            'created_at'
        ]
    },

    parishes: {
        fields: [
            'id',
            'decanato_id',
            'name',
            'address',
            'city',
            'phone',
            'email',
            'parish_priest_name',
            'user_id',
            'created_at'
        ]
    },

    users: {
        fields: [
            'id',
            'username',
            'email',
            'role',
            'parish_id',
            'diocese_id',
            'created_at',
            'last_login'
        ]
    },

    sacrament_records: {
        fields: [
            'id',
            'type',
            'parish_id',
            'diocese_id',
            'first_name',
            'last_name',
            'sacrament_date',
            'minister_name',
            'status',
            'book_number',
            'page_number',
            'entry_number',
            'metadata',
            'created_at',
            'seated_at',
            'imported_at'
        ]
    },

    baptisms: {
        fields: [
            'id',
            'sacrament_record_id',
            'father_name',
            'mother_name',
            'paternal_grandfather',
            'paternal_grandmother',
            'maternal_grandfather',
            'maternal_grandmother',
            'birth_date',
            'birth_place',
            'created_at'
        ]
    },

    catalogs: {
        fields: [
            'id',
            'type',
            'name',
            'code',
            'metadata',
            'created_at'
        ]
    }
});

/* =========================================================
   DEFAULTS
   ========================================================= */

export const DEFAULT_PAGINATION = Object.freeze({
    PAGE_SIZE: 50
});

/* =========================================================
   OPTIONAL DEFAULT EXPORT (DX Friendly)
   ========================================================= */

const SupabaseConfig = {
    TABLE_NAMES,
    ROLE_TYPES,
    SCHEMA_STRUCTURE,
    DEFAULT_PAGINATION
};

export default SupabaseConfig;