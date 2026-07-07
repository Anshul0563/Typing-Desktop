const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "desktopApp",
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    setTypingActive: (active) =>
      ipcRenderer.send("desktop:typing-active", Boolean(active)),
    notify: (title, body) =>
      ipcRenderer.invoke("desktop:notify", { title, body }),
    onNavigate: (listener) => {
      if (typeof listener !== "function") return () => {};
      const handler = (_event, route) => listener(route);
      ipcRenderer.on("desktop:navigate", handler);
      return () => ipcRenderer.removeListener("desktop:navigate", handler);
    },
  }),
);
