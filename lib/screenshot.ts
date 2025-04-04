import { takeScreenshots as takeScreenshotsMachine } from './screenshotMachine';

export interface ScreenshotResult {
  desktopUrl: string;
  mobileUrl: string;
}

export async function takeScreenshots(url: string, id: string): Promise<ScreenshotResult> {
  return takeScreenshotsMachine(url, id);
} 