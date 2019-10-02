/**
 * Created by nativ on 12/02/2017.
 */

//https://developer.chrome.com/extensions/tut_analytics
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-91764690-1']);
_gaq.push(['_trackPageview']);
console.log("init analytics");

(function () {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);

    console.log("inject analytics script");
})();