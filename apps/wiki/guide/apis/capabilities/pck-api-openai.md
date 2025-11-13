# Openai

Package provides implementation of Open AI API 

::: details example
<<< ../../../../../db/tests/pck_api_openai.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_openai.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_openai.sql
:::

## COMPLETION

Procedure serves dialog with Open AI, https://platform.openai.com/docs/api-reference/chat

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_MODEL|IN|VARCHAR2||Model (gpt-4 and dated model releases, gpt-4-1106-preview, gpt-4-vision-preview, gpt-4-32k and dated model releases, gpt-3.5-turbo and dated model releases, gpt-3.5-turbo-16k and dated model releases, fine-tuned versions of gpt-3.5-turbo)|
|P_PROMPT|IN|VARCHAR2||Prompt|
|P_MESSAGE|IN|CLOB||Message|
|R_MESSAGE|OUT|CLOB||Message|
|R_ERROR|OUT|VARCHAR2||Error message|

## IMAGE

Procedure provides image analysis capabilities, https://platform.openai.com/docs/guides/vision

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_MODEL|IN|VARCHAR2||Model (gpt-4 and dated model releases, gpt-4-1106-preview, gpt-4-vision-preview, gpt-4-32k and dated model releases, gpt-3.5-turbo and dated model releases, gpt-3.5-turbo-16k and dated model releases, fine-tuned versions of gpt-3.5-turbo)|
|P_PROMPT|IN|VARCHAR2||Prompt|
|P_N|IN|NUMBER||Number of images (1..10)|
|P_SIZE|IN|VARCHAR2||Image size ('1024x1024', '1024x1792', or '1792x1024')|
|R_ERROR|OUT|VARCHAR2||Error message|
|R_IMAGE|OUT|CLOB||Image in base64 format|

## MODERATIONS

Procedure  provides moderation, https://platform.openai.com/docs/api-reference/moderations

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_MODEL|IN|VARCHAR2||Model (text-moderation-stable, text-moderation-latest)|
|P_PROMPT|IN|VARCHAR2||Prompt|
|R_MODERATIONS|OUT|CLOB||Moderation results|
|R_ERROR|OUT|VARCHAR2||Error message|

## RESPONSES



| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_MODEL|IN|VARCHAR2||Model (tts-1, tts-1-hd)|
|P_INPUT|IN|VARCHAR2||Text prompt|
|P_OPTIONS|IN|CLOB|NULL|Additional options in JSON format|
|R_OUTPUT|OUT|CLOB||Response output|
|R_ERROR|OUT|VARCHAR2||Error message|

## SPEECH

Procedure generates speech from text, https://platform.openai.com/docs/api-reference/audio

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_MODEL|IN|VARCHAR2||Model (tts-1, tts-1-hd)|
|P_INPUT|IN|VARCHAR2||Text|
|P_VOICE|IN|VARCHAR2||Voice (alloy, echo, fable, onyx, nova, shimmer)|
|P_RESPONSE_FORMAT|IN|VARCHAR2||File format (mp3, opus, aac, flac)|
|P_SPEED|IN|FLOAT||Speed (0.25..4)|
|R_SPEECH|OUT|BLOB||Audio file|
|R_ERROR|OUT|VARCHAR2||Error message|

## SPEECH

Procedure generates speech from text, https://platform.openai.com/docs/api-reference/audio

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_INPUT|IN|VARCHAR2||Text|
|R_SPEECH|OUT|BLOB||Audio file|
|R_ERROR|OUT|VARCHAR2||Error message|

## TRANSCRIPT

Procedure transctipts audio file, https://platform.openai.com/docs/api-reference/audio/createTranscription

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_FILE|IN|BLOB||File|
|P_FILENAME|IN|VARCHAR2||Filename|
|P_MODEL|IN|VARCHAR2||Model (whisper-1)|
|P_LANGUAGE|IN|VARCHAR2||Language (ISO-639-1)|
|P_PROMPT|IN|VARCHAR2||Prompt|
|P_RESPONSE_FORMAT|IN|VARCHAR2||Response format (json, text, srt, verbose_json, vtt)|
|P_TEMPERATURE|IN|VARCHAR2||Temperature (0..1)|
|R_TRANSCRIPT|OUT|VARCHAR2||Transcript|
|R_ERROR|OUT|VARCHAR2||Error message|

## TRANSLATIONS

Procedure translates audio file, https://platform.openai.com/docs/api-reference/audio/createTranslations

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_FILE|IN|BLOB||File|
|P_FILENAME|IN|VARCHAR2||Filename|
|P_MODEL|IN|VARCHAR2||Model (whisper-1)|
|P_LANGUAGE|IN|VARCHAR2||Language (ISO-639-1)|
|P_PROMPT|IN|VARCHAR2||Prompt|
|P_RESPONSE_FORMAT|IN|VARCHAR2||Response format (json, text, srt, verbose_json, vtt)|
|P_TEMPERATURE|IN|VARCHAR2||Temperature (0..1)|
|R_TRANSCRIPT|OUT|VARCHAR2||Transcript|
|R_ERROR|OUT|VARCHAR2||Error message|

## VISION

Procedure provides image analysis capabilities, https://platform.openai.com/docs/guides/vision

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_API_KEY|IN|VARCHAR2||OpenAI API Key|
|P_MODEL|IN|VARCHAR2||Model (gpt-4-vision-preview)|
|P_PROMPT|IN|VARCHAR2||Prompt|
|P_IMAGE|IN|CLOB||image in base64 format|
|R_MESSAGE|OUT|CLOB||Vision response|
|R_ERROR|OUT|VARCHAR2||Error message|


