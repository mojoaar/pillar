declare module '@novnc/novnc' {
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: any);
    disconnect(): void;
    sendCredentials(creds: any): void;
    addEventListener(event: string, handler: (e: any) => void): void;
  }
}
