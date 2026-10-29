export function spriteStaysInBrowser(projectDownloaded: boolean, changedSinceDownload: boolean): boolean {
  return !projectDownloaded || changedSinceDownload;
}
