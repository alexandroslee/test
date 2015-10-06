

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title>
	各縣市長將為年輕人做什麼？
</title><link href="css/Mailstyle.css" rel="stylesheet" />
    <script src="js/jquery-1.11.0.min.js"></script>
</head>
<body>
    <form method="post" action="EMail.aspx" id="form1">
<div class="aspNetHidden">
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="/wEPDwULLTE4MTE3NzQyOTVkZFFnTQIdr+vPqsnEYspLmNXzU9jjVikkqBgRMGdpzAge" />
</div>


<script type="text/javascript">
//<![CDATA[
top.location.href='login.aspx';//]]>
</script>

<div class="aspNetHidden">

	<input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="26155A6D" />
	<input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="/wEWCAKd9P7DDQKJrqqqDQKrjZiYBgK+6JRFApvq0dgHArGl/cQCAuWJqqIJAoXOuvwBWmy5hPoDlLRTR5mGNHK4AW07YzUIZrwD26ab8yilWZE=" />
</div>
        <div class="mailBox">
            <p>
                <label for="textfield2" class="label1">寄件者</label>
                <input name="txtSender" type="text" maxlength="50" readonly="readonly" id="txtSender" class="input1" style="border-style:None;" />
                <input type="hidden" name="hfSenderName" id="hfSenderName" />
                <input type="hidden" name="hfSenderMail" id="hfSenderMail" />
            </p>
            <p>
                <label for="textfield2" class="label1">收件者</label>
                <input name="txtRecipients" type="text" id="txtRecipients" class="input1" />
                <span style="display: block; padding-left: 10%; color: #B40003; font-size: 75%">多筆請用 <strong>;</strong> (半形分號)分隔</span>
            </p>
            <p>
                <label for="textfield" class="label1">主旨</label>
                <input name="txtKeynote" type="text" value="各縣市長將為年輕人做什麼？" maxlength="100" id="txtKeynote" class="input1" />
            </p>
            <label for="textarea"></label>
            <textarea name="txtArticle" rows="2" cols="20" id="txtArticle" class="txtarea1">
2014年11月29日的縣市長大選，您將選誰呢？誰才會是您心目中理想人選呢？

1111人力銀行(http://www.1111.com.tw/)關心所有求職者以及求才廠商關心的事情；特別邀請各縣市長候選人，就「如何增加工作機會？ 」、「如何突破22K的夢魘？ 」、「如何幫年輕人創業？ 」、「如何幫年輕人購置房產？ 」四項議題現身說法，利用影片一抒政見。

歡迎您前往 http://www.1111.com.tw/14sp/election/ 觀賞及給予評價。


            1111人力銀行  敬上
            </textarea>            
            <div>
                <input type="submit" name="btnSend" value="確認送出" onclick="return CheckSend();" id="btnSend" class="btn_open" style="float: none; margin-left: auto; margin-right: auto; border: none; display: block; margin-top: 20px" />
            </div>
        </div>
    </form>
    <script type="text/javascript">
        function CheckSend() {
            if ($("#txtRecipients").val().length == 0) {
                alert("請輸入收件者！");
                return false;
            }
            else if ($("#txtKeynote").val().length == 0) {
                alert("請輸入內文！");
                return false;
            }
            else if ($("#txtArticle").val().length == 0) {
                alert("請輸入內文！");
                return false;
            }

            return true;
        }

    </script>
</body>
</html>
