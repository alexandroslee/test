//check browser version, IE7 can't use imagesLoaded
function get_browser(){
    var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
    if(/trident/i.test(M[1])){
        tem=/\brv[ :]+(\d+)/g.exec(ua) || []; 
        return 'IE';
        }   
    if(M[1]==='Chrome'){
        tem=ua.match(/\bOPR\/(\d+)/)
        if(tem!=null)   {return 'Opera '+tem[1];}
        }   
    M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
    return M[0];
}
function get_browser_version(){
    var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];                                                                                                                         
    if(/trident/i.test(M[1])){
        tem=/\brv[ :]+(\d+)/g.exec(ua) || [];
        return (tem[1]||'');
        }
    if(M[1]==='Chrome'){
        tem=ua.match(/\bOPR\/(\d+)/)
        if(tem!=null)   {return 'Opera '+tem[1];}
        }   
    M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
    return M[1];
}
var b = get_browser().toLowerCase();
if(b == "msie" || b == "ie")
{
	b = "ie"
}
var browser=(b+":"+get_browser_version()).toLowerCase();
/*var browser_version=get_browser_version();*/
//alert(browser);
// preload images
if(browser != "ie:7")
{
imagesLoaded( '.mapBlock', function() {
	clearAll();
	$('.mapBlock').show();
	$('.load_mc').hide();
	btnAction();
});
}else{
	clearAll();
	$('.mapBlock').show();
	$('.load_mc').hide();
	btnAction();
}
//
var $total = 22;
//reser all img
function clearAll()
{
	count = 0;
	for( var i=1; i<=$total; i++)
	{
		var $area = ".c"+i;
		$($area).hide();
	}
}
//
//
function btnAction()
{
	$('area').hover(
	function()
	{
		var $n = "."+$(this).attr('class');
		$($n).stop().show();
	},
	function()
	{
		clearAll();
	})
}
