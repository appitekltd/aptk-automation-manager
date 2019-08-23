/*
 *  @module $Force
 *  @desc Used to interact with the ForceTek library for both sandbox and
 *    production environments
 */
var $Force = { 
  'Sandbox': new Forcetek({
    callbackUrl: 'https://www.appitek.com/success.html',
    consumerKey: '3MVG95NPsF2gwOiM6f7BlORxLo5LzOZInr320JB2obQ_GgIhIetQltL1ouNmiX8LiY2oqchdOP6v3A6QSPQld',
    proxyUrl: 'https://www.appitek.com/tools/forcetek/proxy.php',
    loginUrl: 'https://test.salesforce.com/',
    apiVersion: 'v42.0'
  }),
  'Production': new Forcetek({
    callbackUrl: 'https://www.appitek.com/success.html',
    consumerKey: '3MVG95NPsF2gwOiM6f7BlORxLo5LzOZInr320JB2obQ_GgIhIetQltL1ouNmiX8LiY2oqchdOP6v3A6QSPQld',
    proxyUrl: 'https://www.appitek.com/tools/forcetek/proxy.php',
    loginUrl: 'https://login.salesforce.com/',
    apiVersion: 'v42.0'
  }),
  'Salesforce': {}
};