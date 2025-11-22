-- liquibase formatted sql
-- changeset  SqlCl:1763844574398 stripComments:false logicalFilePath:featrecover-password\_custom\010_settings_recover_template.sql
-- sqlcl_snapshot dist\releases\next\changes\featrecover-password\_custom\010_settings_recover_template.sql:null:null:custom


MERGE INTO app_settings d
USING (SELECT 
    'APP_EMAIL_RECOVER_TEMPLATE' AS id, 
    'Password recovery template with {{APP_DOMAIN_NAME}} and {{APP_PASSWORD_RESET_TOKEN}}' AS name, 
    q'[<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#333;background:#f5f5f5;margin:0;padding:0}.container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px 20px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:bold}.content{padding:40px 20px;text-align:center}.content p{margin:15px 0;font-size:16px;line-height:1.6}.button{display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;margin:20px 0;transition:opacity .3s}.button:hover{opacity:.9}.footer{background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;font-size:12px}.footer a{color:#999;text-decoration:none}.footer a:hover{text-decoration:underline}</style></head><body><div class="container"><div class="header"><h1>Reset Your Password</h1></div><div class="content"><p>We received a request to reset your password. Click the button below to create a new password.</p><a href="{{APP_DOMAIN_NAME}}/reset-password/{{APP_PASSWORD_RESET_TOKEN}}" class="button">Reset Password</a><p style="font-size:14px;color:#666">Or copy and paste this link in your browser:</p><p style="font-size:12px;color:#999;word-break:break-all">{{APP_DOMAIN_NAME}}/reset-password/{{APP_PASSWORD_RESET_TOKEN}}</p></div><div class="footer"><p>If you did not request a password reset, you can safely ignore this email.</p></div></div></body></html>]' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);
