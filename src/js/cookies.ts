/**
 * Javascript Cookie Management
 * Dark Side
 */

/**
 * Set a new cookie converting all "=" to "-"
 * so that the name value pairs aren't miss interpreted
 *
 * @param {string} name The Name of the cookie
 * @param {string} value The Value of the cookie
 * @param {string} domain The domain of the cookie
 * @param {string} path The valid path for cookie use : default is "/"
 * @param {Date} expiration The expiration date of the cookie
 */
export function setCookie(name: string, value: string, domain: string, path: string, expiration: Date | undefined = undefined){
  if(domain === undefined){ domain = document.location.hostname; }
  if(path === undefined){ path = document.location.pathname; }
  if(expiration === undefined){
    expiration = new Date();
    expiration.setTime(expiration.getTime() + (24 * 60 * 60 * 1000));
  }

  name = name.replaceAll("=", "-");
  value = value.replaceAll("=", "-");
  let expire = "";
  if(expiration !== undefined){
    expire = " expires=" + expiration.toUTCString() + "; ";
  }
  console.log("Setting cookie: ", name + "=" + value + "; domain=" + domain + ";" + expire + " path=" + path);
  document.cookie = name + "=" + value + ";domain=" + domain + ";" + expire + " path=" + path;
  return {name, value};
}

/**
 * Get a cookie from the Document
 *
 * @param {string} name The Name of the cookie
 */
export function getCookie(name: string){
  name = name + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookies = decodedCookie.split(";");
  for(let i = 0; i < cookies.length; i++){
    let cookie = cookies[i];
    while(cookie.charAt(0) === " "){
      cookie = cookie.substring(1);
    }
    if(cookie.indexOf(name) === 0){
      return {name, value: cookie.substring(name.length, cookie.length)};
    }
  }
  return undefined;
}

/**
 * Get all cookies as an array from the Document
 */
export function getAllCookies(){
  if(document.cookie === ""){
    return [];
  }
  const results = [];
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookies = decodedCookie.split(";");
  for(let i = 0; i < cookies.length; i++){
    let cookie = cookies[i];
    while(cookie.charAt(0) === " "){
      cookie = cookie.substring(1);
    }
    const parts = cookie.split("=");
    results.push({name: parts[0], value: parts[1]});
  }
  return results;
}

/**
 * Check if a cookie exists in the document
 *
 * @param {string} name The Name of the cookie
 */
export function isCookieSet(name: string){
  if(getCookie(name) !== undefined){
    return true;
  }else{
    return false;
  }
}

/**
 * Deletes a cookie by setting the value to empty string and the timeout to -1
 *
 * @param {string} name The Name of the cookie
 */
export function deleteCookie(name: string, domain = document.location.hostname, path = document.location.pathname){
  document.cookie = name + "=null" + "; expires=-1; domain=" + domain + "; path=" + path;
}

/**
 * Get an expiration date shifted by hours
 *
 * @param {int} hours = The number of hours before expiration : default is 24
 */
export function getCookieExpiration(hours = 24){
  const date = new Date();
  date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
  return date;
}