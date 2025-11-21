-- liquibase formatted sql
-- changeset  SqlCl:1763716696688 stripComments:false logicalFilePath:featsignup\_custom\010_signup.sql
-- sqlcl_snapshot dist\releases\next\changes\featsignup\_custom\010_signup.sql:null:null:custom

SET DEFINE OFF;

MERGE INTO app_settings d
USING (SELECT 
    'APP_AUTH_PASSWORD_REQUIREMENTS' AS id, 
    'App authentication password requirements (12..120 chars, at least one upper letter, lower letter, number and symbol)' AS name, 
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\[\]{};:",.<>/?-]).{12,120}$' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 
    'APP_AUTH_PASSWORD_MESSAGE' AS id, 
    'App authentication password requirements message (12..120 chars, at least one upper letter, lower letter, number and symbol)' AS name, 
    'password.must.be.12-120.characters.long.with.at.least.one.upper.case.letter.,.lower.case.letter.,.number.and.special.symbol' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 
    'APP_DOMAIN_NAME' AS id, 
    'App domain name' AS name, 
    'https://apps.odbvue.com' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);


MERGE INTO app_settings d
USING (SELECT 
    'APP_EMAIL_VERIFY_TEMPLATE' AS id, 
    'Email verification template with {{APP_DOMAIN_NAME}} and {{APP_EMAIL_VERIFY_TOKEN}}' AS name, 
    q'[<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#333;background:#f5f5f5;margin:0;padding:0}.container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px 20px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:bold}.content{padding:40px 20px;text-align:center}.content p{margin:15px 0;font-size:16px;line-height:1.6}.button{display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;margin:20px 0;transition:opacity .3s}.button:hover{opacity:.9}.footer{background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;font-size:12px}.footer a{color:#999;text-decoration:none}.footer a:hover{text-decoration:underline}</style></head><body><div class="container"><div class="header"><h1>Confirm Your Email</h1></div><div class="content"><p>Thank you for signing up! Please confirm your email address to get started.</p><a href="{{APP_DOMAIN_NAME}}/confirm-email/{{APP_EMAIL_VERIFY_TOKEN}}" class="button">Confirm Email</a><p style="font-size:14px;color:#666">Or copy and paste this link in your browser:</p><p style="font-size:12px;color:#999;word-break:break-all">{{APP_DOMAIN_NAME}}/confirm-email/{{APP_EMAIL_VERIFY_TOKEN}}</p></div><div class="footer"><p>If you did not sign up for this account, you can <a href="{{APP_DOMAIN_NAME}}/unsubscribe">unsubscribe</a> here.</p></div></div></body></html>]' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

