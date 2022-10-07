export type BrowserName =
	"Android Browser" |
	"Chrome" |
	"Chrome for Android" |
	"Chrome for iOS" |
	"Firefox" |
	"Firefox for iOS" |
	"Firefox for Android" |
	"Edge" |
	"Opera" |
	"Opera Mini" |
	"Opera (Mobile)" |
	"BlackBerry" |
	"Safari" |
	"Safari Mobile" |
	"Googlebot" |
	"UC Browser" |
	"Internet Explorer" |
	"Internet Explorer (Mobile)" |
	"Samsung Internet" |
	"UNKNOWN"
;

const BROWSER_ICON = {
  "Android Browser": "fa-android",
  "Chrome": "fa-chrome",
  "Chrome for iOS": "fa-chrome",
  "Chrome for Android": "fa-chrome",
  "Firefox": "fa-firefox",
  "Firefox for iOS": "fa-firefox",
  "Firefox for Android": "fa-firefox",
  "Edge": "fa-edge",
  "Opera": "fa-opera",
  "Opera Mini": "fa-opera",
  "Opera (Mobile)": "fa-opera",
  "BlackBerry": "fa-blackberry",
  "Safari": "fa-safari",
  "Safari Mobile": "fa-safari",
  "Googlebot": "fa-android",
  "UC Browser": "",
  "Internet Explorer": "fa-internet-explorer",
  "Internet Explorer (Mobile)": "fa-internet-explorer",
  "Samsung Internet": "",
  "UNKNOWN": ""
} as Record<BrowserName, string>;


export type OS =
	"Windows Phone" |
	"Windows" |
	"OS X" |
	"Linux" |
	"iOS" |
	"Android" |
	"BlackBerry" |
	"BlackBerry Tablet OS" |
	"BlackBerryOS" |
	"Chrome OS" |
	"KaiOS" |
	"UNKNOWN"
;

export type BrowserData = {
	browser: {
		name: BrowserName
		version: string
		maj_version: number
		icon: string
		zoom: number,
		cookies_enabled: boolean
	}
	os: {
		name: OS,
		version: string
	},
	screen: {
		width: number
		height: number
		colors: number
	},
	websockets: boolean,
	lang: string | readonly string[]
}

function getBrowser(agent?: string): BrowserName{
  if(agent === undefined){
    agent = navigator.userAgent;
  }
  if(agent.indexOf("SamsungBrowser/") !== -1){
    return "Samsung Internet";
  }
  if(agent.indexOf("Chrome/") !== -1 && agent.indexOf("Edge/") === -1
		&& agent.indexOf("Android") === -1
		&& agent.indexOf("OPR/") === -1 && agent.indexOf("Googlebot/") === -1){
    return "Chrome";
  }
  if(agent.indexOf("Chrome/") !== -1 && agent.indexOf("Android") !== -1
		&& agent.indexOf("OPR/") === -1  && agent.indexOf("UCBrowser/") === -1
		&& agent.indexOf("Windows Phone") === -1){
    return "Chrome for Android";
  }
  if (agent.indexOf("Android") !== -1 && agent.indexOf("Chrome") === -1
		&& agent.indexOf("Chromium") === -1 && agent.indexOf("Trident") === -1
		&& agent.indexOf("Firefox") === -1 && agent.indexOf("Opera") === -1
		&& agent.indexOf("UCBrowser/") === -1 && agent.indexOf("Windows Phone") === -1){
    return "Android Browser";
  }
  if(agent.indexOf("CriOS/") !== -1){
    return "Chrome for iOS";
  }
  if(agent.indexOf("KAIOS/") !== -1 || (agent.indexOf("Firefox/") !== -1 && agent.indexOf("Android") !== -1)){
    return "Firefox for Android";
  }
  if(agent.indexOf("Edge/") !== -1){
    return "Edge";
  }
  if(agent.indexOf("Gecko/") !== -1){
    return "Firefox";
  }
  if(agent.indexOf("FxiOS/") !== -1){
    return "Firefox for iOS";
  }
  if(agent.indexOf("UCBrowser/") !== -1){
    return "UC Browser";
  }
  if((agent.indexOf("OPR/") !== -1 || agent.indexOf("Opera/") !== -1)
		&& agent.indexOf("Android") === -1 && agent.indexOf("Opera Mobi/") === -1
		&& agent.indexOf("Opera Tablet/") === -1 ){
    return "Opera";
  }
  if(agent.indexOf("Opera Mini/") !== -1){
    return "Opera Mini";
  }
  if(agent.indexOf("Opera Mobi/") !== -1 || agent.indexOf("Opera Tablet/") !== -1 ||
		(agent.indexOf("Android") !== -1 && agent.indexOf("OPR/") !== -1)){
    return "Opera (Mobile)";
  }
  if(agent.indexOf("AppleWebKit/") !== -1 && agent.indexOf("Mobile Safari/") === -1
	&& agent.indexOf("BlackBerry") === -1 && agent.indexOf("BB10;") === -1
	&& agent.indexOf("RIM Tablet OS") === -1){
    return "Safari";
  }
  if(agent.indexOf("AppleWebKit/") !== -1 && agent.indexOf("Mobile Safari/") !== -1
	&& agent.indexOf("Googlebot/") === -1 && agent.indexOf("IEMobile/") === -1
	&& agent.indexOf("RIM Tablet OS") === -1 && agent.indexOf("BlackBerry") === -1
	&& agent.indexOf("BB10;") === -1){
    return "Safari Mobile";
  }
  if(agent.indexOf("BlackBerry") !== -1 || agent.indexOf("RIM Tablet OS") !== -1
	|| agent.indexOf("BB10;") !== -1){
    return "BlackBerry";
  }
  if(agent.indexOf("Googlebot/") !== -1){
    return "Googlebot";
  }
  if(agent.indexOf("IEMobile/") !== -1){
    return "Internet Explorer (Mobile)";
  }
  if(agent.indexOf("MSIE ") !== -1){
    return "Internet Explorer";
  }
  if(agent.indexOf("rv:11.0") !== -1){
    return "Internet Explorer";
  }
  return "UNKNOWN";
}

function getBrowserIcon(browser?: BrowserName): string{
  if(browser === undefined){
    browser = getBrowser();
  }
  if(BROWSER_ICON[browser] === null){
    return "";
  }
  return BROWSER_ICON[browser];
}

function getBrowserVersion(type?: BrowserName, agent?: string): string{
  if(agent === undefined){
    agent = navigator.userAgent;
  }
  if(type === undefined){
    type = getBrowser(agent);
  }
  let data = undefined;
  switch(type){
  case "Chrome": case "Chrome for Android":
    data = agent.split("Chrome/")[1].split(" ");
    return data[0];
  case "Android Browser":
    if(agent.indexOf("Version") === -1){
      data = agent.split("Android ")[1].split(";");
      return data[0];
    }
    data = agent.split("Version/")[1].split(" ");
    return data[0];
  case "Chrome for iOS":
    data = agent.split("CriOS/")[1].split(" ");
    return data[0];
  case "Samsung Internet":
    data = agent.split("SamsungBrowser/")[1].split(" ");
    return data[0];
  case "Firefox": case "Firefox for Android":
    data = agent.split("Firefox/")[1].split(" ");
    return data[0];
  case "Firefox for iOS":
    data = agent.split("FxiOS/")[1].split(" ");
    return data[0];
  case "UC Browser":
    data = agent.split("UCBrowser/")[1].split(" ");
    return data[0];
  case "Edge":
    data = agent.split("Edge/")[1].split(" ");
    return data[0];
  case "Opera":
    if(agent.indexOf("OPR") !== -1){
      data = agent.split("OPR/")[1].split(" ");
      return data[0];
    }
    if(agent.indexOf("Windows NT 6.0") !== -1){
      data = agent.split("Version/")[1].split(" ");
      return data[0];
    }
    data = agent.split("Opera/")[1].split(" ");
    return data[0];
  case "Opera (Mobile)":
    if(agent.indexOf("OPR") === -1){
      data = agent.split("Version/")[1].split(" ");
      return data[0];
    }
    data = agent.split("OPR/")[1].split(" ");
    return data[0];
  case "Opera Mini":
    data = agent.split("Opera Mini/")[1].split("/");
    return data[0];
  case "BlackBerry":
  case "Safari":
  case "Safari Mobile":
    data = agent.split("Version/")[1].split(" ");
    return data[0];
  case "Googlebot":
    data = agent.split("Googlebot/")[1].split(" ");
    return data[0].replace(";", "");
  case "Internet Explorer":
    if(agent.includes("rv:")){
      data = agent.split("rv:")[1].split(" ");
      return data[0].replace(")", "");
    }
    data = agent.split("MSIE ")[1].split(" ");
    return data[0].replace(";", "");
  case "Internet Explorer (Mobile)":
    data = agent.split("IEMobile/")[1].split(" ");
    return data[0].replace(";", "");
  default:
    return "UNKNOWN";
  }
}

function getBrowserMajorVersion(version?: string): number{
  if(version === undefined){
    version = getBrowserVersion();
  }
  if(version === "UNKNOWN"){
    return -1;
  }
  return parseInt(version.split(".")[0]);
}

function getOS(agent?: string): OS{
  if(agent === undefined){
    agent = navigator.userAgent;
  }
  // Extract operating system name from user agent
  if (agent.indexOf("Windows") >= 0){
    if (agent.indexOf("Windows Phone") >= 0){
      return "Windows Phone";
    } else {
      return "Windows";
    }
  }
  if (agent.indexOf("OS X") >= 0 && agent.indexOf("Android") === -1 && agent.indexOf("like Mac OS X") === -1){
    return "OS X";
  }
  if (agent.indexOf("Linux") >= 0 && agent.indexOf("Android") === -1 && agent.indexOf("Mobile") === -1){
    return "Linux";
  }
  if (agent.indexOf("like Mac OS X") >= 0){
    return "iOS";
  }
  if (agent.indexOf("KAIOS") >= 0){
    return "KaiOS";
  }
  if ((agent.indexOf("Android") >= 0 || agent.indexOf("Adr") >= 0) && agent.indexOf("Windows Phone") === -1){
    return "Android";
  }
  if (agent.indexOf("BB10") >= 0){
    return "BlackBerry";
  }
  if (agent.indexOf("RIM Tablet OS") >= 0){
    return "BlackBerry Tablet OS";
  }
  if (agent.indexOf("BlackBerry") >= 0){
    return "BlackBerryOS";
  }
  if (agent.indexOf("CrOS") >= 0){
    return "Chrome OS";
  }
  return "UNKNOWN";
}

function getOSVersion(agent?: string): string{
  if(agent === undefined){
    agent = navigator.userAgent;
  }
  const os_name = getOS(agent);
  let match = null;

  switch (os_name){
  case "Windows":
  case "Windows Phone":
    if (agent.indexOf("Win16") >= 0){
      return "3.1.1";
    } else if (agent.indexOf("Windows CE") >= 0){
      return "CE";
    } else if (agent.indexOf("Windows 95") >= 0){
      return "95";
    } else if (agent.indexOf("Windows 98") >= 0){
      if (agent.indexOf("Windows 98; Win 9x 4.90") >= 0){
        return "Millennium Edition";
      } else {
        return "98";
      }
    } else {
      match = agent.match(/Win(?:dows)?(?: Phone)?[ _]?(?:(?:NT|9x) )?((?:(\d+\.)*\d+)|XP|ME|CE)\b/);

      if (match && match[1]){
        switch (match[1]){
        case "6.4":
          // Some versions of Firefox mistakenly used 6.4
          match[1] = "10.0";
          break;
        case "6.3":
          match[1] = "8.1";
          break;
        case "6.2":
          match[1] = "8";
          break;
        case "6.1":
          match[1] = "7";
          break;
        case "6.0":
          match[1] = "Vista";
          break;
        case "5.2":
          match[1] = "Server 2003";
          break;
        case "5.1":
          match[1] = "XP";
          break;
        case "5.01":
          match[1] = "2000 SP1";
          break;
        case "5.0":
          match[1] = "2000";
          break;
        case "4.0":
          match[1] = "4.0";
          break;
        default:
          // Nothing
          break;
        }
      }
    }
    break;
  case "OS X":
    match = agent.match(/OS X ((\d+[._])+\d+)\b/);
    break;
  case "Linux":
    // Linux user agent strings do not usually include the version
    return "UNKNOWN";
  case "iOS":
    match = agent.match(/OS ((\d+[._])+\d+) like Mac OS X/);
    break;
  case "Android":
    match = agent.match(/(?:Android|Adr) (\d+([._]\d+)*)/);
    break;
  case "BlackBerry":
  case "BlackBerryOS":
    match = agent.match(/Version\/((\d+\.)+\d+)/);
    break;
  case "BlackBerry Tablet OS":
    match = agent.match(/RIM Tablet OS ((\d+\.)+\d+)/);
    break;
  case "Chrome OS":
    return getBrowserVersion("Chrome", agent);
  case "KaiOS":
    match = agent.match(/KAIOS\/(\d+(\.\d+)*)/);
    break;
  default:
    return "UNKNOWN";
  }

  if (match && match[1]){
    match[1] = match[1].replace(/_/g, ".");
    return match[1];
  }
  return "UNKNOWN";
}

function areCookiesEnabled(){
  let uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  uuid = uuid.replace(/[xy]/g, function(c){
    const r = Math.random() * 16 | 0;
    const v = c === "x"
      ? r
      : (r & 0x3 | 0x8);

    return v.toString(16);
  });
  document.cookie = uuid;

  let result = false;
  if (document.cookie.indexOf(uuid) >= 0){
    result = true;
  }
  // Delete temporary cookie
  document.cookie = uuid + "=; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  return result;
}

export default function browserData(agent?: string): BrowserData{
  const browser = getBrowser(agent);
  let version = "UNKNOWN";
  try{
    version = getBrowserVersion(browser, agent);
  }catch(e){
    console.log(agent);
  }
  const client_width = document.documentElement.clientWidth;
  const inner_width = window.innerWidth;
  return {
    browser: {
      name: browser,
      version,
      maj_version: getBrowserMajorVersion(version),
      icon: getBrowserIcon(browser),
      zoom: client_width / inner_width || client_width,
      cookies_enabled: areCookiesEnabled()
    },
    os: {
      name: getOS(agent),
      version: getOSVersion(agent)
    },
    screen: {
      width: screen.width,
      height: screen.height,
      colors: screen.colorDepth
    },
    websockets: !!window.WebSocket,
    lang: navigator.languages || navigator.language
  };
}