const autoUpdater = require("electron-updater");
const electron = require("electron");
app.on("ready", () => {
	autoUpdater.checkForUpdatesAndNotify();
});