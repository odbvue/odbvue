DEFINE title = 'Settings';
DEFINE script = 'pck_api_settings';
DEFINE uri = 'pck-api-settings'
SET FEEDBACK OFF
SPOOL C:\Users\erlihs\odbvue\apps\wiki\guide\apis\capabilities\&&uri..md
exec prc_mdify('PACKAGE=&&script','&&title');
SPOOL OFF
SET FEEDBACK ON
