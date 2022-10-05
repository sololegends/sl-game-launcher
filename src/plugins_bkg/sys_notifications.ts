
import { BrowserWindow, IpcMain, nativeImage, Notification } from "electron";
import { Notify } from "@/types/notification/notify";


export default function init(ipcMain: IpcMain, win: BrowserWindow){
  ipcMain.on("sys-notify", (e, notify: Notify.Alert, icon?: string, event?: string, event_data?: unknown) => {
    const data = {
      title: notify.title,
      silent: false
    } as Electron.NotificationConstructorOptions;
    if(notify.text){
      data.body = notify.text;
    }
    if(icon){
      data.icon = nativeImage.createFromDataURL(icon);
    }
    const notification = new Notification(data);
    if(event){
      notification.on("click", () => {
        win?.webContents.send(event, event_data);
      });
    }
    notification.show();
  });
}