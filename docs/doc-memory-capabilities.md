Comprehensive Database, Caching & Memory Technical Documentation

  Executive Summary

  This repository implements a sophisticated dual-storage architecture
  combining SQLite and Firebase with comprehensive encryption, migration
  systems, and memory management. The system supports both offline-first
  local usage and cloud-synchronized authenticated usage with seamless
  transitions.

  ---
  1. DATABASE ARCHITECTURE

  1.1 Dual Repository Pattern

  Architecture Design: The system implements a repository adapter pattern
  that dynamically switches between SQLite and Firebase based on
  authentication state.

  Core Components:
  - Repository Adapter Layer (src/features/common/repositories/*/index.js):
  Abstracts storage implementation
  - SQLite Repositories: Local database operations with better-sqlite3
  - Firebase Repositories: Cloud Firestore with real-time sync capabilities

  Storage Selection Logic:
  function getBaseRepository() {
      const user = authService.getCurrentUser();
      if (user && user.isLoggedIn) {
          return firebaseRepository;  // Authenticated users → Firebase
      }
      return sqliteRepository;        // Default/offline → SQLite
  }

  1.2 SQLite Implementation

  Database Client (src/features/common/services/sqliteClient.js):
  - Connection Management: Singleton pattern with WAL mode for better
  concurrency
  - Database Location: ~/Library/Application 
  Support/Subliminal/subliminal.db (macOS)
  - Performance Optimizations:
    - WAL (Write-Ahead Logging) mode enabled via pragma('journal_mode = 
  WAL')
    - Prepared statements for all queries
    - Transaction batching for bulk operations

  Schema Management:
  - Latest Schema (src/features/common/config/schema.js): Centralized schema
   definition
  - Dynamic Schema Sync (sqliteClient.synchronizeSchema()): Automatic
  table/column additions
  - Migration Support: Custom migration logic for schema changes (e.g.,
  provider_settings table restructuring)

  Database Tables:
  -- Core Tables
  users (uid, display_name, email, created_at, auto_update_enabled,
  has_migrated_to_firebase)
  sessions (id, uid, title, session_type, started_at, ended_at, sync_state,
  updated_at)
  ai_messages (id, session_id, sent_at, role, content, tokens, model,
  created_at, sync_state)
  transcripts (id, session_id, start_at, end_at, speaker, text, lang,
  created_at, sync_state)
  summaries (session_id, generated_at, model, text, tldr, bullet_json,
  action_json)

  -- Configuration Tables  
  prompt_presets (id, uid, title, prompt, is_default, created_at,
  sync_state)
  provider_settings (provider, api_key, selected_llm_model,
  selected_stt_model, is_active_llm, is_active_stt)
  shortcuts (action, accelerator, created_at)
  permissions (uid, keychain_completed)

  -- Local AI Models
  ollama_models (name, size, installed, installing)
  whisper_models (id, name, size, installed, installing)

  1.3 Firebase Integration

  Configuration (src/features/common/services/firebaseClient.js):
  - Database: Custom Firestore instance targeting "subliminal" database
  - Authentication: Custom persistence using Electron Store for token
  management
  - Collection Structure:
    - Top-level: sessions, prompt_presets
    - Sub-collections: sessions/{sessionId}/ai_messages,
  sessions/{sessionId}/transcripts

  Persistence Strategy:
  // Custom Electron Store persistence for Firebase Auth
  class ElectronStorePersistence {
      constructor() {
          this.store = sharedStore;
          this.type = 'LOCAL';
      }
      async _set(key, value) { this.store.set(key, value); }
      async _get(key) { return this.store.get(key) ?? null; }
      async _remove(key) { this.store.delete(key); }
  }

  ---
  2. ENCRYPTION & SECURITY

  2.1 Field-Level Encryption

  Implementation (src/features/common/services/encryptionService.js):
  - Algorithm: AES-256-GCM with 16-byte IV and 16-byte auth tag
  - Key Management: OS keychain (keytar) with in-memory fallback
  - Key Storage: Per-user keys stored in system keychain (com.pickle.glass
  service)

  Encryption Process:
  function encrypt(text) {
      const key = Buffer.from(sessionKey, 'hex');
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      let encrypted = cipher.update(String(text), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Format: [IV(16) + AuthTag(16) + EncryptedContent] → base64
      return Buffer.concat([iv, authTag, Buffer.from(encrypted,
  'hex')]).toString('base64');
  }

  2.2 Firestore Encryption Converter

  Auto-Encryption (src/features/common/repositories/firestoreConverter.js):
  - Field-Specific: Encrypts specified fields during Firestore writes
  - Transparent Decryption: Automatic decryption on reads with error
  handling
  - Legacy Compatibility: Graceful handling of unencrypted legacy data

  Usage Example:
  const sessionConverter = createEncryptedConverter(['title']);
  const sessionsCol = collection(db,
  'sessions').withConverter(sessionConverter);

  2.3 Security Features

  Key Security Measures:
  - Per-user encryption keys (never shared between users)
  - OS-level keychain integration for key persistence
  - Graceful degradation to session-only keys if keychain unavailable
  - Automatic key initialization on user authentication
  - Permission tracking for keychain access completion

  ---
  3. MIGRATION & SYNCHRONIZATION

  3.1 SQLite-to-Firebase Migration

  Migration Service (src/features/common/services/migrationService.js):
  - Trigger: Automatic on Firebase authentication
  - Scope: User-specific data migration with encryption
  - Batch Processing: 500 operations per Firestore batch (API limit
  compliance)
  - Two-Phase Design:
    - Phase 1: Parent documents (sessions, presets)
    - Phase 2: Child documents (messages, transcripts, summaries)

  Migration Process:
  // Phase 1: Parent Documents
  const localPresets = await sqlitePresetRepo.getPresets(firebaseUser.uid);
  for (const preset of localPresets) {
      const presetRef = doc(db, 'prompt_presets', preset.id);
      const cleanPreset = {
          title: encryptionService.encrypt(preset.title ?? ''),
          prompt: encryptionService.encrypt(preset.prompt ?? ''),
          // ... other fields with encryption
      };
      phase1Batch.set(presetRef, cleanPreset);
  }

  3.2 Schema Synchronization

  Dynamic Schema Updates:
  - Table Creation: Automatic creation of missing tables
  - Column Addition: Non-destructive column additions
  - Constraint Handling: Primary key and constraint management
  - Migration Safety: Robust error handling with rollback capabilities

  Special Case Handling:
  - Custom migration logic for provider_settings table restructuring
  - ROW_NUMBER() window functions for deduplication
  - Dynamic column mapping for schema evolution

  ---
  4. MEMORY & CACHING STRATEGIES

  4.1 In-Memory State Management

  OllamaService Caching (src/features/common/services/ollamaService.js):
  - Model State Caching:
    - installedModels Map: Cached installed model list
    - warmedModels Set: Models loaded in memory
    - warmingModels Map: Active warming operations
    - modelLoadStatus Map: Memory load status tracking
  - Request Deduplication: Single active request pattern prevents concurrent
   API calls
  - State Synchronization: 30-second periodic sync with Ollama daemon

  Caching Architecture:
  class OllamaService {
      constructor() {
          // Memory state caches
          this.installedModels = new Map();
          this.modelWarmupStatus = new Map();
          this.warmedModels = new Set();
          this.warmingModels = new Map();

          // Request management
          this.activeRequest = null;
          this.requestTimeout = 30000;
      }
  }

  4.2 Authentication State Caching

  AuthService Memory Management
  (src/features/common/services/authService.js):
  - Current User State: In-memory caching of authentication state
  - Virtual Key Caching: Per-session API key storage
  - Session Management: Active session state with automatic cleanup

  4.3 Database Connection Pooling

  SQLite Connection Management:
  - Singleton Pattern: Single database connection per application instance
  - Connection Persistence: Long-lived connections with proper cleanup
  - Prepared Statement Caching: better-sqlite3 handles statement preparation
   optimization

  Firebase Connection Management:
  - Connection Sharing: Firestore SDK handles connection pooling internally
  - Authentication Persistence: Custom Electron Store integration for token
  caching

  4.4 Performance Optimizations

  Query Optimization Strategies:
  - Indexed Queries: Strategic use of ORDER BY and WHERE clauses
  - Batch Operations: Transaction batching for bulk inserts/updates
  - Lazy Loading: On-demand model loading and warm-up
  - Memory Management: Automatic cleanup of inactive model states

  Caching Invalidation:
  - Model State Sync: 30-second intervals with change detection
  - Authentication State: Real-time Firebase onAuthStateChanged
  - Session Management: Touch-based last access tracking

  ---
  5. CONVERSATION MEMORY SYSTEM

  5.1 Session-Based Context Management

  Session Architecture:
  - Persistent Sessions: Sessions survive application restarts
  - Context Retrieval: Last 30 messages included in AI prompts
  (_formatConversationForPrompt)
  - Session Types: 'ask' and 'listen' modes with promotion capability
  - Active Session Management: getOrCreateActive() maintains conversation
  continuity

  Message Storage:
  ai_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT,           -- 'user' or 'assistant'
      content TEXT,        -- Full message content
      sent_at INTEGER,     -- Unix timestamp
      tokens INTEGER,      -- Token count for billing
      model TEXT,          -- AI model used
      created_at INTEGER   -- Record creation time
  )

  5.2 Cross-Session Memory

  User Session History:
  - Session Retrieval: getAllByUserId() ordered by recency
  - Session Metadata: Titles, timestamps, types for conversation browsing
  - Data Relationships: Cascading deletes maintain referential integrity

  5.3 Context Optimization

  Memory-Efficient Context Handling:
  - Token Limit Management: 30-message sliding window to control context
  size
  - Session Pruning: Automatic cleanup of empty sessions
  - Storage Optimization: Sync state tracking for cloud/local consistency

  ---
  6. TECHNICAL DECISIONS & TRADE-OFFS

  6.1 Architecture Decisions

  Dual Storage Rationale:
  - Offline-First: SQLite enables full functionality without internet
  - Cloud Sync: Firebase provides cross-device synchronization
  - User Choice: Seamless transition between modes based on authentication

  Security Trade-offs:
  - Performance vs Security: Field-level encryption adds computational
  overhead
  - Key Management: OS keychain dependency with graceful fallback
  - Migration Security: Encrypted data transfer during SQLite→Firebase
  migration

  6.2 Performance Considerations

  Database Performance:
  - SQLite WAL Mode: Better concurrent read performance
  - Firebase Batching: 500-operation batches balance performance and
  reliability
  - Query Optimization: Strategic indexing and prepared statements

  Memory Management:
  - Model Warm-up: Trade memory usage for response speed
  - Cache Size Limits: Prevent unbounded memory growth
  - Connection Pooling: Balance resource usage and performance

  6.3 Scalability Factors

  Current Limitations:
  - SQLite Concurrency: Limited concurrent write performance
  - Context Window: 30-message limit may truncate long conversations
  - Memory Usage: Model caching increases RAM requirements

  Scaling Solutions:
  - Firebase Migration: Cloud storage removes local size constraints
  - Pagination: Session list pagination for large histories
  - Model Management: Dynamic loading/unloading based on usage patterns

  ---
  7. MONITORING & OBSERVABILITY

  7.1 Logging Strategy

  Comprehensive Logging:
  - Database Operations: Connection, query, and migration logging
  - Encryption Events: Key initialization and encryption status
  - Service States: Ollama service, Firebase connection status
  - Error Tracking: Detailed error context with service identification

  7.2 Health Checks

  Service Health Monitoring:
  - Database Connectivity: SQLite file access and Firebase connection
  - Encryption Status: Key availability and encryption capability
  - Model Service Status: Ollama daemon health and model availability
  - Memory Usage: Model loading status and memory consumption

  This comprehensive architecture enables robust offline-first operation
  with seamless cloud synchronization, enterprise-grade encryption, and
  sophisticated conversation memory management while maintaining high
  performance and reliability.