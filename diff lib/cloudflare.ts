// STEP 2: Combined geo + risk check with ProxyCheck.io (supports IPv4 & IPv6)
const pcUrl = 'https://proxycheck.io/v2/' + clientIP + '?key=' + PROXYCHECK_API_KEY + '&risk=1&asn=1'; 