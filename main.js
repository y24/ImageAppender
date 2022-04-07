const electron = require('electron')
const path = require('path')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

let mainWindow
let launchArgs = null;

function createWindow () {

  const screen = electron.screen.getPrimaryDisplay()
  const width = 1024
  const height = 790
  const x = parseInt(screen.workAreaSize.width*0.5 - width*0.5)
  const y = parseInt(screen.workAreaSize.height*0.5 - height*0.5)

  //create the browser window
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    autoHideManuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  })

  //Remove menubar(Windows)
  //メニューバー非表示
  mainWindow.setMenu(null)

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()


  // アプリ未起動時にファイルがドロップされた場合
  let _launchArgs = launchArgs;
  mainWindow.webContents.on('did-finish-load', () => {
    if (_launchArgs && _launchArgs.filePath) {
      const filePath = _launchArgs.filePath;
      _launchArgs = null;
      mainWindow.webContents.send('dropToAppIcon', filePath);
    }

    mainWindow.show();
    mainWindow.focus();
  })

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Dockにドロップされたファイルをレンダラープロセスに渡す
app.on('will-finish-launching', () => {
  app.on('open-file', (e, filePath) => {
    e.preventDefault();

    if(mainWindow){
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      mainWindow.webContents.send('dropToAppIcon', filePath);
    } else {
      launchArgs = { filePath: filePath };
    }
  });
});