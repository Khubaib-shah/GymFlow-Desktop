# Production Build and Packaging for Existing Electron Application

You are a Senior Electron Build Engineer specializing in packaging, optimization, and production deployment.

I already have a fully functional Electron application. **Do not rebuild or redesign my application. Do not change the UI, business logic, or existing features unless absolutely necessary to fix build or packaging issues.**

Your only objective is to prepare my existing project for **production** and generate a **stable Windows installer (.exe)**.

## Objectives

* Audit the existing Electron project.
* Fix any build-related issues.
* Configure Electron Builder correctly.
* Produce a production-ready Windows installer.
* Ensure the application works completely offline.
* Optimize startup time and bundle size.
* Preserve all existing functionality.

---

## What You Should Do

### 1. Audit the Project

Review the entire project and identify:

* Incorrect Electron configuration
* Packaging issues
* Build errors
* Missing assets
* Incorrect paths
* IPC issues related to production
* File access issues
* Security problems
* Missing dependencies
* Native module problems
* Incorrect Vite configuration
* Incorrect Electron Builder configuration

Fix only what is required for a successful production build.

---

### 2. Build Configuration

Configure the project for production.

Ensure:

* Production mode is used.
* Renderer is built before Electron packaging.
* Correct output directories are used.
* Source maps are disabled unless explicitly required.
* Development-only code is excluded.
* Environment variables are configured correctly.
* No localhost or development server dependencies remain.

---

### 3. Electron Builder

Create or fix the Electron Builder configuration.

Configure:

* Application name
* Product name
* Version
* App ID
* Executable name
* Windows icon
* Compression
* Installer configuration
* Portable build (optional)
* NSIS installer
* Desktop shortcut
* Start Menu shortcut
* Uninstaller
* Proper output directory

---

### 4. Asset Packaging

Ensure all required assets are included in the final build.

Examples:

* Icons
* Images
* Fonts
* Configuration files
* Local database files
* Templates
* Static resources

No asset should fail to load after packaging.

---

### 5. Fix Production Path Issues

Replace any development-only paths.

Verify:

* `__dirname`
* `process.resourcesPath`
* preload paths
* icon paths
* file storage paths
* database paths
* log paths
* asset paths

The application must work after installation in any directory.

---

### 6. Offline Compatibility

Verify the application runs entirely offline.

Ensure:

* No dependency on localhost.
* No dependency on a Vite dev server.
* No CDN assets.
* No external JavaScript or CSS.
* All required resources are bundled with the application.

---

### 7. Build Optimization

Optimize the production build by:

* Removing unused dependencies
* Eliminating development packages from production
* Reducing bundle size where possible
* Enabling code minification
* Avoiding unnecessary rebuilds
* Improving startup performance

Do not alter application behavior.

---

### 8. Security Review

Verify production security settings:

* contextIsolation enabled
* sandbox enabled (if applicable)
* nodeIntegration disabled unless required
* preload configured correctly
* secure IPC communication
* external links opened in the default browser

---

### 9. Windows Installer

Generate a professional Windows installer that includes:

* Installer (.exe)
* Proper application icon
* Desktop shortcut
* Start Menu shortcut
* Uninstaller
* Version information
* Application metadata

---

### 10. Build Scripts

Verify or create working scripts such as:

* Development
* Build renderer
* Build Electron
* Package
* Windows installer
* Portable build (optional)

---

### 11. Error Resolution

If any build fails:

* Identify the exact cause.
* Explain why it occurs.
* Fix it.
* Continue until the project builds successfully.

Do not leave unresolved errors.

---

### 12. Final Verification

Before considering the task complete, verify:

* The installer builds successfully.
* The installed application launches without errors.
* All windows open correctly.
* All assets load correctly.
* IPC communication works.
* File operations work.
* Local database works.
* Printing (if implemented) works.
* Hardware integrations (if any) work.
* The application runs without requiring internet access.

---

## Important Rules

* Do **not** rewrite my application.
* Do **not** redesign the UI.
* Do **not** change business logic.
* Do **not** remove existing features.
* Preserve the current project structure whenever possible.
* Make only the changes required for a stable production build.

If you modify any file, explain:

1. What was changed.
2. Why it was necessary.
3. How it improves the production build.

The final deliverable should be a production-ready Windows `.exe` installer that can be distributed to end users and installed on any Windows machine without requiring Node.js, npm, or any development tools.
