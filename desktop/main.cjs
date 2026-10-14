const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  session,
  dialog,
} = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

// A secure local origin lets the existing module worker run offline, without
// a web server, a separately installed browser, or Node.js on the user's PC.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "parvis",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const ROOT = path.join(__dirname, "..", "dist");
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Parvis",
    width: 1400,
    height: 1020,
    minWidth: 760,
    minHeight: 600,
    backgroundColor: "#101113",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("parvis://app/")) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL("parvis://app/index.html");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app
    .whenReady()
    .then(() => {
      app.setAppUserModelId("se.skolaai.parvis");
      Menu.setApplicationMenu(null);
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      protocol.handle("parvis", async (request) => {
        try {
          const url = new URL(request.url);
          if (url.hostname !== "app")
            return new Response("Not found", { status: 404 });
          const relative = decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          );
          const file = path.resolve(ROOT, "." + relative);
          if (!file.startsWith(ROOT + path.sep))
            return new Response("Forbidden", { status: 403 });
          const body = await readFile(file);
          return new Response(body, {
            headers: {
              "Content-Type":
                types[path.extname(file)] || "application/octet-stream",
              "Content-Security-Policy": CSP,
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });
      session.defaultSession.on("will-download", (_event, item) => {
        item.setSaveDialogOptions({
          title: "Spara CSV-export",
          defaultPath: item.getFilename(),
          filters: [{ name: "CSV", extensions: ["csv"] }],
        });
      });
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("Parvis kunde inte starta", error.message);
      app.quit();
    });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
