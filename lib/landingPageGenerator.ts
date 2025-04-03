import { ILandingPage } from './models/LandingPage';

export function generateLandingPageHtml(landingPage: ILandingPage): string {
  const { affiliateUrl, desktopScreenshotUrl, mobileScreenshotUrl } = landingPage;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${landingPage.name}</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.png">
  <link rel="shortcut icon" href="https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.ico" type="image/x-icon">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      overflow: hidden;
    }

    .background-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      z-index: -2;
      overflow: hidden;
      background-color: #000;
    }

    .background-image-mobile {
      position: absolute;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      opacity: .4;
      background-image: url('${mobileScreenshotUrl}');
    }

    .background-image-desktop {
      position: absolute;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: top center;
      opacity: .4;
      background-image: url('${desktopScreenshotUrl}');
    }

    /* Base */
    #background-image-desktop {
      display: block;
    }

    #background-image-mobile {
      display: none;
    }

    /* Media query */
    @media (max-width: 768px) {
      #background-image-desktop {
        display: none;
      }

      #background-image-mobile {
        display: block;
      }
    }

    .modal-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: white;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      text-align: center;
      z-index: 1;
      max-width: 500px;
    }

    @media (max-width: 768px) {
      #modal-container {
        max-width: 620px;
      }
    }

    .modal-image-desktop {
      border-radius: 12px;
      object-fit: cover;
      width: 100%;
      display: block;
    }

    .modal-image-mobile {
      border-radius: 12px;
      object-fit: cover;
      display: none;
      max-width: 300px;
    }
    /* Base */
    #modal-image-desktop {
      display: block;
    }

    #modal-image-mobile {
      display: none;
    }

    /* Media query */
    @media (max-width: 768px) {
      #modal-image-desktop {
        display: none;
      }

      #modal-image-mobile {
        display: block;
      }
    }
  </style>
</head>
<body>
  <div class="background-container">
    <div id="background-image-desktop" class="background-image-desktop"></div>
    <div id="background-image-mobile" class="background-image-mobile"></div>
  </div>
  <span style="display: none;">
    This website uses cookies to improve the user experience. By continuing to browse, you agree to the use of cookies.
  </span>
  <a href="${affiliateUrl}" target="_self">
    <div id="modal-container" class="modal-container">
      <img id="modal-image-desktop" src="https://storage.googleapis.com/filtrify-public-assets/filtripage/presellTypes/en/cookies_en_desktop.png" alt="${landingPage.name}" class="modal-image-desktop">
      <img id="modal-image-mobile" src="https://storage.googleapis.com/filtrify-public-assets/filtripage/presellTypes/en/cookies_en_mobile.png" alt="${landingPage.name}" class="modal-image-mobile">
    </div>
  </a>
</body>
</html>`;
} 