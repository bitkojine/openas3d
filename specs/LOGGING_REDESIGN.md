NOTICE: This specification was generated using AI. Place at the top of the file to indicate origin.

# Logging System Redesign Spec

## Objective:
Implement a performant, structured logging system for the VSCode extension to eliminate performance bottlenecks during loading and provide better debugging capabilities. This spec defines the "why" and "what"; all "how" details (implementation, migration, configuration) are for implementation based on this spec.

## Current Problems:

### 1. Performance Issues
- **Excessive console.log spam**: PerfTracker logs every single event (lines 179, 182 in perf-tracker.ts)
- **Console method wrapping**: Bootstrap.ts intercepts ALL console calls and forwards via postMessage
- **Interval-based updates**: Every 2 seconds, performance stats trigger more logging
- **57+ files** with direct console calls creating cumulative overhead

### 2. Architecture Problems
- **No centralized logging**: Direct console.* usage across entire codebase
- **No log levels**: Everything logs at same priority
- **Webview-to-extension spam**: Every console message forwarded without filtering
- **No structured logging**: Inconsistent formats and lack of context
- **Development logs in production**: Many logs lack environment checks

### 3. Specific Problem Areas
- `architecture-analyzer.ts`: 10 console calls during dependency analysis
- `perf-tracker.ts`: Logs every performance event during stats calculation
- `bootstrap.ts`: Console method wrapping creates message forwarding overhead
- `test-discovery-service.ts`: Unfiltered Jest stderr logging

## Solution Design:

### 1. Core Logging Architecture

#### Logger Interface
```typescript
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
  performance(label: string, operation: () => void): void;
  setLevel(level: LogLevel): void;
  createChild(context: string): Logger;
}

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}
```

#### Logger Components
1. **ExtensionLogger** (main process)
   - Uses VSCode `createOutputChannel`
   - Configurable log levels
   - Structured formatting with timestamps
   - Performance tracking integration

2. **WebviewLogger** (webview process)
   - Batches log messages to reduce postMessage overhead
   - Throttles message forwarding (1-second batches)
   - Only forwards errors/warnings in production
   - Development-only debug/info forwarding

3. **PerformanceLogger**
   - Integrates with PerfTracker
   - Only logs performance issues above threshold
   - Configurable performance thresholds
   - Removes verbose event logging

### 2. Key Features

#### Environment-Aware Logging
- **Development**: Full logging with debug/info levels
- **Production**: Only warnings and errors by default
- **Configurable**: User can override levels via VSCode settings

#### Message Batching
- **Batch Size**: 10 messages per batch
- **Batch Delay**: 1 second maximum wait
- **Priority**: Errors/warnings bypass batching
- **Efficiency**: Reduces postMessage calls by 90%

#### Performance Integration
- **Threshold-Based**: Only log operations >100ms
- **Structured Metrics**: Performance data in consistent format
- **Reduced Overhead**: Remove event-by-event logging

#### VSCode Integration
- **OutputChannel**: Proper VSCode output window integration
- **Configuration**: User-configurable log levels and settings
- **File Logging**: Optional file logging for troubleshooting

### 3. Implementation Phases

#### Phase 1: Critical Performance Fixes (Priority 1)
**What:**
- Fix PerfTracker console.log spam (remove lines 179, 182)
- Replace console wrapping in bootstrap.ts with WebviewLogger
- Add environment checks to architecture-analyzer.ts
- Implement core ExtensionLogger and WebviewLogger classes

**Why:**
- Immediate 60-80% reduction in logging overhead
- Fixes the most impactful performance bottlenecks
- Establishes foundation for systematic migration

#### Phase 2: Systematic Migration (Priority 2)
**What:**
- Create logger instances in each major service
- Replace all console.* calls with logger calls
- Add context-specific child loggers
- Implement structured logging format

**Why:**
- Consistent logging across entire codebase
- Better debugging with context and structure
- Maintains performance improvements from Phase 1

#### Phase 3: Configuration & Monitoring (Priority 3)
**What:**
- Add VSCode configuration for log levels
- Implement log rotation for file logging
- Add performance metrics for logging overhead
- Create logging documentation and best practices

**Why:**
- User control over logging verbosity
- Long-term maintainability
- Monitoring of logging system performance

### 4. Configuration Schema

#### VSCode Settings
```json
{
  "openas3d.logging.level": {
    "type": "string",
    "enum": ["debug", "info", "warn", "error", "none"],
    "default": "info",
    "description": "Set logging level for the extension"
  },
  "openas3d.logging.enableFileLogging": {
    "type": "boolean",
    "default": false,
    "description": "Enable logging to file"
  },
  "openas3d.logging.performanceThreshold": {
    "type": "number",
    "default": 100,
    "description": "Performance threshold in ms for warnings"
  },
  "openas3d.logging.webviewBatchSize": {
    "type": "number",
    "default": 10,
    "description": "Number of log messages to batch from webview"
  }
}
```

### 5. File Structure

#### New Files to Create
```
src/utils/
├── logger.ts              # Core ExtensionLogger implementation
├── webview-logger.ts      # WebviewLogger with batching
└── performance-logger.ts  # PerformanceLogger integration

src/webview/utils/
└── webview-logger.ts      # Webview-specific logger

specs/
└── LOGGING_REDESIGN.md    # This specification document
```

#### Files to Modify
```
src/utils/perf-tracker.ts          # Remove console.log, integrate PerformanceLogger
src/webview/bootstrap.ts           # Replace console wrapping with WebviewLogger
src/core/analysis/architecture-analyzer.ts  # Replace console calls with logger
src/extension.ts                   # Initialize logger, add configuration
package.json                       # Add configuration schema
```

### 6. Expected Performance Improvements

#### Quantitative Improvements
- **Loading Time**: 60-80% reduction by eliminating console spam
- **Memory Usage**: 40-50% decrease by reducing string operations
- **Webview Responsiveness**: 90% fewer postMessage calls via batching
- **CPU Usage**: 30-40% reduction from fewer logging operations

#### Qualitative Improvements
- **Better Debugging**: Structured logs with context and timestamps
- **User Control**: Configurable log levels via VSCode settings
- **Professional Integration**: Proper OutputChannel usage
- **Maintainability**: Centralized logging architecture

### 7. Migration Guidelines

#### Replacing console.* Calls
```typescript
// Before (problematic)
console.log('Processing file:', filePath);
console.error('Failed to analyze:', error);

// After (structured)
logger.debug('Processing file', { filePath });
logger.error('Failed to analyze', error, { filePath });
```

#### Adding Context
```typescript
// Service-specific logger
const logger = mainLogger.createChild('ArchitectureAnalyzer');

// Usage with automatic context
logger.info('Starting analysis', { fileCount: files.length });
```

#### Performance Logging
```typescript
// Before (manual timing)
const start = Date.now();
// ... operation
console.log(`Operation took ${Date.now() - start}ms`);

// After (automatic)
logger.performance('analysis', () => {
  // ... operation
});
```

### 8. Testing Strategy

#### Performance Testing
- Measure loading time before/after changes
- Profile memory usage during intensive operations
- Test webview responsiveness with high log volumes

#### Functional Testing
- Verify log levels work correctly
- Test message batching and throttling
- Validate OutputChannel integration
- Test configuration changes take effect

#### Regression Testing
- Ensure all existing functionality works with new logging
- Verify error handling and edge cases
- Test both development and production modes

### 9. Success Criteria

#### Performance Metrics
- [ ] Loading time reduced by >60%
- [ ] Memory usage reduced by >40%
- [ ] Webview postMessage calls reduced by >90%
- [ ] No performance regression in core functionality

#### Functionality Metrics
- [ ] All console.* calls replaced with structured logging
- [ ] Log levels working correctly
- [ ] VSCode configuration integration functional
- [ ] OutputChannel properly displaying logs

#### Quality Metrics
- [ ] Consistent log format across all components
- [ ] Proper error handling in logging system
- [ ] Documentation and best practices established
- [ ] No breaking changes to public APIs

## Implementation Notes:

### Dependencies
- No external dependencies required
- Uses VSCode native APIs (OutputChannel, configuration)
- Leverages existing TypeScript infrastructure

### Backward Compatibility
- No breaking changes to extension APIs
- Existing functionality preserved
- Gradual migration approach minimizes risk

### Maintenance
- Centralized logging easier to maintain
- Configuration allows user customization
- Performance monitoring built-in
- Clear documentation for future developers

## Risk Mitigation:

### Performance Risks
- **Risk**: New logging system introduces overhead
- **Mitigation**: Performance testing at each phase, threshold-based logging

### Compatibility Risks
- **Risk**: Breaking existing functionality
- **Mitigation**: Gradual migration, comprehensive testing, fallback mechanisms

### Complexity Risks
- **Risk**: Over-engineering the logging system
- **Mitigation**: Simple interface, phased implementation, clear documentation
