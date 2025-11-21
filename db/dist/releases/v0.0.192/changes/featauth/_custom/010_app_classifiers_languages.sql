-- liquibase formatted sql
-- changeset  SqlCl:1763704090039 stripComments:false logicalFilePath:featauth\_custom\010_app_classifiers.sql
-- sqlcl_snapshot dist\releases\next\changes\featauth\_custom\010_app_classifiers.sql:null:null:custom

MERGE INTO app_languages tgt
USING (
    SELECT 'aa' id, 'aar' iso3, 'Afar' name, 'Afaraf' native FROM dual UNION ALL
    SELECT 'ab' id, 'abk' iso3, 'Abkhazian' name, 'аҧсуа' native FROM dual UNION ALL
    SELECT 'ae' id, 'ave' iso3, 'Avestan' name, 'avesta' native FROM dual UNION ALL
    SELECT 'af' id, 'afr' iso3, 'Afrikaans' name, 'Afrikaans' native FROM dual UNION ALL
    SELECT 'ak' id, 'aka' iso3, 'Akan' name, 'Akan' native FROM dual UNION ALL
    SELECT 'am' id, 'amh' iso3, 'Amharic' name, 'አማርኛ' native FROM dual UNION ALL
    SELECT 'an' id, 'arg' iso3, 'Aragonese' name, 'aragonés' native FROM dual UNION ALL
    SELECT 'ar' id, 'ara' iso3, 'Arabic' name, 'العربية' native FROM dual UNION ALL
    SELECT 'as' id, 'asm' iso3, 'Assamese' name, 'অসমীয়া' native FROM dual UNION ALL
    SELECT 'av' id, 'ava' iso3, 'Avaric' name, 'магӀарул' native FROM dual UNION ALL
    SELECT 'ay' id, 'aym' iso3, 'Aymara' name, 'aymar aru' native FROM dual UNION ALL
    SELECT 'az' id, 'aze' iso3, 'Azerbaijani' name, 'azərbaycanca' native FROM dual UNION ALL
    SELECT 'ba' id, 'bak' iso3, 'Bashkir' name, 'башҡортса' native FROM dual UNION ALL
    SELECT 'be' id, 'bel' iso3, 'Belarusian' name, 'беларуская' native FROM dual UNION ALL
    SELECT 'bg' id, 'bul' iso3, 'Bulgarian' name, 'български' native FROM dual UNION ALL
    SELECT 'bh' id, 'bih' iso3, 'Bihari' name, 'भोजपुरी' native FROM dual UNION ALL
    SELECT 'bi' id, 'bis' iso3, 'Bislama' name, 'Bislama' native FROM dual UNION ALL
    SELECT 'bm' id, 'bam' iso3, 'Bambara' name, 'bamanankan' native FROM dual UNION ALL
    SELECT 'bn' id, 'ben' iso3, 'Bengali' name, 'বাংলা' native FROM dual UNION ALL
    SELECT 'bo' id, 'bod' iso3, 'Tibetan' name, 'བོད་ཡིག' native FROM dual UNION ALL
    SELECT 'br' id, 'bre' iso3, 'Breton' name, 'brezhoneg' native FROM dual UNION ALL
    SELECT 'bs' id, 'bos' iso3, 'Bosnian' name, 'bosanski' native FROM dual UNION ALL
    SELECT 'ca' id, 'cat' iso3, 'Catalan' name, 'català' native FROM dual UNION ALL
    SELECT 'ce' id, 'che' iso3, 'Chechen' name, 'нохчийн' native FROM dual UNION ALL
    SELECT 'ch' id, 'cha' iso3, 'Chamorro' name, 'Chamoru' native FROM dual UNION ALL
    SELECT 'co' id, 'cos' iso3, 'Corsican' name, 'corsu' native FROM dual UNION ALL
    SELECT 'cr' id, 'cre' iso3, 'Cree' name, 'ᒃᕀᒪ' native FROM dual UNION ALL
    SELECT 'cs' id, 'ces' iso3, 'Czech' name, 'čeština' native FROM dual UNION ALL
    SELECT 'cu' id, 'chu' iso3, 'Church Slavic' name, 'ѩзыкъ словѣньскъ' native FROM dual UNION ALL
    SELECT 'cv' id, 'chv' iso3, 'Chuvash' name, 'чӑваш чӗлхи' native FROM dual UNION ALL
    SELECT 'cy' id, 'cym' iso3, 'Welsh' name, 'Cymraeg' native FROM dual UNION ALL
    SELECT 'da' id, 'dan' iso3, 'Danish' name, 'dansk' native FROM dual UNION ALL
    SELECT 'de' id, 'deu' iso3, 'German' name, 'Deutsch' native FROM dual UNION ALL
    SELECT 'dv' id, 'div' iso3, 'Divehi' name, 'ދިވެހި' native FROM dual UNION ALL
    SELECT 'dz' id, 'dzo' iso3, 'Dzongkha' name, 'རྫོང་ཁ' native FROM dual UNION ALL
    SELECT 'ee' id, 'ewe' iso3, 'Ewe' name, 'Eʋegbe' native FROM dual UNION ALL
    SELECT 'el' id, 'ell' iso3, 'Greek' name, 'ελληνικά' native FROM dual UNION ALL
    SELECT 'en' id, 'eng' iso3, 'English' name, 'English' native FROM dual UNION ALL
    SELECT 'eo' id, 'epo' iso3, 'Esperanto' name, 'Esperanto' native FROM dual UNION ALL
    SELECT 'es' id, 'spa' iso3, 'Spanish' name, 'Español' native FROM dual UNION ALL
    SELECT 'et' id, 'est' iso3, 'Estonian' name, 'eesti' native FROM dual UNION ALL
    SELECT 'eu' id, 'eus' iso3, 'Basque' name, 'euskara' native FROM dual UNION ALL
    SELECT 'fa' id, 'fas' iso3, 'Persian' name, 'فارسی' native FROM dual UNION ALL
    SELECT 'ff' id, 'ful' iso3, 'Fulah' name, 'Fulfulde' native FROM dual UNION ALL
    SELECT 'fi' id, 'fin' iso3, 'Finnish' name, 'suomi' native FROM dual UNION ALL
    SELECT 'fj' id, 'fij' iso3, 'Fijian' name, 'Vakaviti' native FROM dual UNION ALL
    SELECT 'fo' id, 'fao' iso3, 'Faroese' name, 'føroyskt' native FROM dual UNION ALL
    SELECT 'fr' id, 'fra' iso3, 'French' name, 'Français' native FROM dual UNION ALL
    SELECT 'fy' id, 'fry' iso3, 'Western Frisian' name, 'Frysk' native FROM dual UNION ALL
    SELECT 'ga' id, 'gle' iso3, 'Irish' name, 'Gaeilge' native FROM dual UNION ALL
    SELECT 'gd' id, 'gla' iso3, 'Scottish Gaelic' name, 'Gàidhlig' native FROM dual UNION ALL
    SELECT 'gl' id, 'glg' iso3, 'Galician' name, 'galego' native FROM dual UNION ALL
    SELECT 'gn' id, 'grn' iso3, 'Guarani' name, 'Avañe''ẽ' native FROM dual UNION ALL
    SELECT 'gu' id, 'guj' iso3, 'Gujarati' name, 'ગુજરાતી' native FROM dual UNION ALL
    SELECT 'gv' id, 'glv' iso3, 'Manx' name, 'Gaelg' native FROM dual UNION ALL
    SELECT 'ha' id, 'hau' iso3, 'Hausa' name, 'Hausa' native FROM dual UNION ALL
    SELECT 'he' id, 'heb' iso3, 'Hebrew' name, 'עברית' native FROM dual UNION ALL
    SELECT 'hi' id, 'hin' iso3, 'Hindi' name, 'हिन्दी' native FROM dual UNION ALL
    SELECT 'ho' id, 'hmo' iso3, 'Hiri Motu' name, 'Hiri Motu' native FROM dual UNION ALL
    SELECT 'hr' id, 'hrv' iso3, 'Croatian' name, 'hrvatski' native FROM dual UNION ALL
    SELECT 'ht' id, 'hat' iso3, 'Haitian' name, 'Kreyòl ayisyen' native FROM dual UNION ALL
    SELECT 'hu' id, 'hun' iso3, 'Hungarian' name, 'magyar' native FROM dual UNION ALL
    SELECT 'hy' id, 'hye' iso3, 'Armenian' name, 'Հայերեն' native FROM dual UNION ALL
    SELECT 'hz' id, 'her' iso3, 'Herero' name, 'Otjiherero' native FROM dual UNION ALL
    SELECT 'ia' id, 'ina' iso3, 'Interlingua' name, 'Interlingua' native FROM dual UNION ALL
    SELECT 'id' id, 'ind' iso3, 'Indonesian' name, 'Bahasa Indonesia' native FROM dual UNION ALL
    SELECT 'ie' id, 'ile' iso3, 'Interlingue' name, 'Interlingue' native FROM dual UNION ALL
    SELECT 'ig' id, 'ibo' iso3, 'Igbo' name, 'Asụsụ Igbo' native FROM dual UNION ALL
    SELECT 'ii' id, 'iii' iso3, 'Sichuan Yi' name, 'ꆈꌠꉙ' native FROM dual UNION ALL
    SELECT 'ik' id, 'ipk' iso3, 'Inupiaq' name, 'Iñupiaq' native FROM dual UNION ALL
    SELECT 'in' id, 'ind' iso3, 'Indonesian' name, 'Bahasa Indonesia' native FROM dual UNION ALL
    SELECT 'io' id, 'ido' iso3, 'Ido' name, 'Ido' native FROM dual UNION ALL
    SELECT 'is' id, 'isl' iso3, 'Icelandic' name, 'Íslenska' native FROM dual UNION ALL
    SELECT 'it' id, 'ita' iso3, 'Italian' name, 'Italiano' native FROM dual UNION ALL
    SELECT 'iu' id, 'iku' iso3, 'Inuktitut' name, 'ᐃᓄᒃᑎᑐᑦ' native FROM dual UNION ALL
    SELECT 'iw' id, 'heb' iso3, 'Hebrew' name, 'עברית' native FROM dual UNION ALL
    SELECT 'ja' id, 'jpn' iso3, 'Japanese' name, '日本語' native FROM dual UNION ALL
    SELECT 'jv' id, 'jav' iso3, 'Javanese' name, 'basa Jawa' native FROM dual UNION ALL
    SELECT 'ka' id, 'kat' iso3, 'Georgian' name, 'ქართული' native FROM dual UNION ALL
    SELECT 'kg' id, 'kon' iso3, 'Kongo' name, 'Kikongo' native FROM dual UNION ALL
    SELECT 'ki' id, 'kik' iso3, 'Kikuyu' name, 'Gikuyu' native FROM dual UNION ALL
    SELECT 'kj' id, 'kua' iso3, 'Kuanyama' name, 'Ekakosa' native FROM dual UNION ALL
    SELECT 'kk' id, 'kaz' iso3, 'Kazakh' name, 'қазақ тілі' native FROM dual UNION ALL
    SELECT 'kl' id, 'kal' iso3, 'Kalaallisut' name, 'kalaallisut' native FROM dual UNION ALL
    SELECT 'km' id, 'khm' iso3, 'Khmer' name, 'ខ្មែរ' native FROM dual UNION ALL
    SELECT 'kn' id, 'kan' iso3, 'Kannada' name, 'ಕನ್ನಡ' native FROM dual UNION ALL
    SELECT 'ko' id, 'kor' iso3, 'Korean' name, '한국어' native FROM dual UNION ALL
    SELECT 'kr' id, 'kau' iso3, 'Kanuri' name, 'Kanuri' native FROM dual UNION ALL
    SELECT 'ks' id, 'kas' iso3, 'Kashmiri' name, 'कश्मीरी' native FROM dual UNION ALL
    SELECT 'ku' id, 'kur' iso3, 'Kurdish' name, 'Kurdî' native FROM dual UNION ALL
    SELECT 'kv' id, 'kom' iso3, 'Komi' name, 'коми кыв' native FROM dual UNION ALL
    SELECT 'kw' id, 'cor' iso3, 'Cornish' name, 'Kernewek' native FROM dual UNION ALL
    SELECT 'ky' id, 'kir' iso3, 'Kirghiz' name, 'Кыргызча' native FROM dual UNION ALL
    SELECT 'la' id, 'lat' iso3, 'Latin' name, 'latine' native FROM dual UNION ALL
    SELECT 'lb' id, 'ltz' iso3, 'Luxembourgish' name, 'Lëtzebuergesch' native FROM dual UNION ALL
    SELECT 'lg' id, 'lug' iso3, 'Ganda' name, 'Luganda' native FROM dual UNION ALL
    SELECT 'li' id, 'lim' iso3, 'Limburgish' name, 'Limburgish' native FROM dual UNION ALL
    SELECT 'ln' id, 'lin' iso3, 'Lingala' name, 'Lingála' native FROM dual UNION ALL
    SELECT 'lo' id, 'lao' iso3, 'Lao' name, 'ພາສາລາວ' native FROM dual UNION ALL
    SELECT 'lt' id, 'lit' iso3, 'Lithuanian' name, 'lietuvių' native FROM dual UNION ALL
    SELECT 'lu' id, 'lub' iso3, 'Luba-Katanga' name, 'Luba-Katanga' native FROM dual UNION ALL
    SELECT 'lv' id, 'lav' iso3, 'Latvian' name, 'latviešu' native FROM dual UNION ALL
    SELECT 'mg' id, 'mgl' iso3, 'Malagasy' name, 'Malagasy' native FROM dual UNION ALL
    SELECT 'mh' id, 'mah' iso3, 'Marshallese' name, 'Kajin M̧ajeļ' native FROM dual UNION ALL
    SELECT 'mi' id, 'mri' iso3, 'Maori' name, 'Te Reo Māori' native FROM dual UNION ALL
    SELECT 'mk' id, 'mkd' iso3, 'Macedonian' name, 'македонски' native FROM dual UNION ALL
    SELECT 'ml' id, 'mal' iso3, 'Malayalam' name, 'മലയാളം' native FROM dual UNION ALL
    SELECT 'mn' id, 'mon' iso3, 'Mongolian' name, 'Монгол' native FROM dual UNION ALL
    SELECT 'mo' id, 'mol' iso3, 'Moldavian' name, 'Moldovan' native FROM dual UNION ALL
    SELECT 'mr' id, 'mar' iso3, 'Marathi' name, 'मराठी' native FROM dual UNION ALL
    SELECT 'ms' id, 'msa' iso3, 'Malay' name, 'Bahasa Melayu' native FROM dual UNION ALL
    SELECT 'mt' id, 'mlt' iso3, 'Maltese' name, 'Malti' native FROM dual UNION ALL
    SELECT 'my' id, 'mya' iso3, 'Burmese' name, 'ဗမာ' native FROM dual UNION ALL
    SELECT 'na' id, 'nau' iso3, 'Nauru' name, 'Ekakairũ Naoero' native FROM dual UNION ALL
    SELECT 'nb' id, 'nob' iso3, 'Norwegian Bokmål' name, 'Norsk bokmål' native FROM dual UNION ALL
    SELECT 'nd' id, 'nde' iso3, 'North Ndebele' name, 'isiNdebele' native FROM dual UNION ALL
    SELECT 'ne' id, 'nep' iso3, 'Nepali' name, 'नेपाली' native FROM dual UNION ALL
    SELECT 'ng' id, 'ndo' iso3, 'Ndonga' name, 'Oshiwambo' native FROM dual UNION ALL
    SELECT 'nl' id, 'nld' iso3, 'Dutch' name, 'Nederlands' native FROM dual UNION ALL
    SELECT 'nn' id, 'nno' iso3, 'Norwegian Nynorsk' name, 'Norsk nynorsk' native FROM dual UNION ALL
    SELECT 'no' id, 'nor' iso3, 'Norwegian' name, 'Norsk' native FROM dual UNION ALL
    SELECT 'nr' id, 'nbl' iso3, 'South Ndebele' name, 'isiNdebele' native FROM dual UNION ALL
    SELECT 'nv' id, 'nav' iso3, 'Navajo' name, 'Diné bizaad' native FROM dual UNION ALL
    SELECT 'ny' id, 'nya' iso3, 'Chichewa' name, 'Chi-Chewa' native FROM dual UNION ALL
    SELECT 'oc' id, 'oci' iso3, 'Occitan' name, 'Occitan' native FROM dual UNION ALL
    SELECT 'oj' id, 'oji' iso3, 'Ojibwa' name, 'ᐊᓂᔑᓂᓂᐎᓐ' native FROM dual UNION ALL
    SELECT 'om' id, 'orm' iso3, 'Oromo' name, 'Afan Oromo' native FROM dual UNION ALL
    SELECT 'or' id, 'ory' iso3, 'Odia' name, 'ଓଡ଼ିଆ' native FROM dual UNION ALL
    SELECT 'os' id, 'oss' iso3, 'Ossetian' name, 'ирон æвзаг' native FROM dual UNION ALL
    SELECT 'pa' id, 'pan' iso3, 'Punjabi' name, 'ਪੰਜਾਬੀ' native FROM dual UNION ALL
    SELECT 'pi' id, 'pli' iso3, 'Pali' name, 'पाळि' native FROM dual UNION ALL
    SELECT 'pl' id, 'pol' iso3, 'Polish' name, 'Polski' native FROM dual UNION ALL
    SELECT 'ps' id, 'pus' iso3, 'Pushto' name, 'پښتو' native FROM dual UNION ALL
    SELECT 'pt' id, 'por' iso3, 'Portuguese' name, 'Português' native FROM dual UNION ALL
    SELECT 'qu' id, 'que' iso3, 'Quechua' name, 'Quechua' native FROM dual UNION ALL
    SELECT 'rm' id, 'roh' iso3, 'Romansh' name, 'Rumantsch' native FROM dual UNION ALL
    SELECT 'rn' id, 'run' iso3, 'Rundi' name, 'Kirundi' native FROM dual UNION ALL
    SELECT 'ro' id, 'ron' iso3, 'Romanian' name, 'Română' native FROM dual UNION ALL
    SELECT 'ru' id, 'rus' iso3, 'Russian' name, 'Русский' native FROM dual UNION ALL
    SELECT 'rw' id, 'kin' iso3, 'Kinyarwanda' name, 'Kinyarwanda' native FROM dual UNION ALL
    SELECT 'sa' id, 'san' iso3, 'Sanskrit' name, 'संस्कृतम्' native FROM dual UNION ALL
    SELECT 'sc' id, 'srd' iso3, 'Sardinian' name, 'sardu' native FROM dual UNION ALL
    SELECT 'sd' id, 'snd' iso3, 'Sindhi' name, 'سندھی' native FROM dual UNION ALL
    SELECT 'se' id, 'sme' iso3, 'Northern Sami' name, 'Davvisámegiella' native FROM dual UNION ALL
    SELECT 'sg' id, 'sag' iso3, 'Sango' name, 'yângâ tî sängö' native FROM dual UNION ALL
    SELECT 'sh' id, 'hbs' iso3, 'Serbo-Croatian' name, 'Serbo-Croatian' native FROM dual UNION ALL
    SELECT 'si' id, 'sin' iso3, 'Sinhala' name, 'සිංහල' native FROM dual UNION ALL
    SELECT 'sk' id, 'slk' iso3, 'Slovak' name, 'slovenčina' native FROM dual UNION ALL
    SELECT 'sl' id, 'slv' iso3, 'Slovenian' name, 'slovenščina' native FROM dual UNION ALL
    SELECT 'sm' id, 'smo' iso3, 'Samoan' name, 'Gagana fa''a Samoa' native FROM dual UNION ALL
    SELECT 'sn' id, 'sna' iso3, 'Shona' name, 'ChiShona' native FROM dual UNION ALL
    SELECT 'so' id, 'som' iso3, 'Somali' name, 'Soomaaliga' native FROM dual UNION ALL
    SELECT 'sq' id, 'sqi' iso3, 'Albanian' name, 'Shqip' native FROM dual UNION ALL
    SELECT 'sr' id, 'srp' iso3, 'Serbian' name, 'Српски' native FROM dual UNION ALL
    SELECT 'ss' id, 'ssw' iso3, 'Swati' name, 'SiSwati' native FROM dual UNION ALL
    SELECT 'st' id, 'sot' iso3, 'Sotho' name, 'seSotho' native FROM dual UNION ALL
    SELECT 'su' id, 'sun' iso3, 'Sundanese' name, 'Basa Sunda' native FROM dual UNION ALL
    SELECT 'sv' id, 'swe' iso3, 'Swedish' name, 'Svenska' native FROM dual UNION ALL
    SELECT 'sw' id, 'swa' iso3, 'Swahili' name, 'Kiswahili' native FROM dual UNION ALL
    SELECT 'ta' id, 'tam' iso3, 'Tamil' name, 'தமிழ்' native FROM dual UNION ALL
    SELECT 'te' id, 'tel' iso3, 'Telugu' name, 'తెలుగు' native FROM dual UNION ALL
    SELECT 'tg' id, 'tgk' iso3, 'Tajik' name, 'тоҷикӣ' native FROM dual UNION ALL
    SELECT 'th' id, 'tha' iso3, 'Thai' name, 'ไทย' native FROM dual UNION ALL
    SELECT 'ti' id, 'tir' iso3, 'Tigrinya' name, 'ትግርኛ' native FROM dual UNION ALL
    SELECT 'tk' id, 'tuk' iso3, 'Turkmen' name, 'Türkmençe' native FROM dual UNION ALL
    SELECT 'tl' id, 'tgl' iso3, 'Tagalog' name, 'Tagalog' native FROM dual UNION ALL
    SELECT 'tn' id, 'tsn' iso3, 'Tswana' name, 'Setswana' native FROM dual UNION ALL
    SELECT 'to' id, 'ton' iso3, 'Tonga' name, 'Lea faka-Tonga' native FROM dual UNION ALL
    SELECT 'tp' id, 'tpi' iso3, 'Tok Pisin' name, 'Tok Pisin' native FROM dual UNION ALL
    SELECT 'tr' id, 'tur' iso3, 'Turkish' name, 'Türkçe' native FROM dual UNION ALL
    SELECT 'ts' id, 'tso' iso3, 'Tsonga' name, 'Xitsonga' native FROM dual UNION ALL
    SELECT 'tt' id, 'tat' iso3, 'Tatar' name, 'татарча' native FROM dual UNION ALL
    SELECT 'tw' id, 'twi' iso3, 'Twi' name, 'Twi' native FROM dual UNION ALL
    SELECT 'ty' id, 'tah' iso3, 'Tahitian' name, 'Reo Tahiti' native FROM dual UNION ALL
    SELECT 'ug' id, 'uig' iso3, 'Uighur' name, 'ئۇيغۇرچە' native FROM dual UNION ALL
    SELECT 'uk' id, 'ukr' iso3, 'Ukrainian' name, 'Українська' native FROM dual UNION ALL
    SELECT 'ur' id, 'urd' iso3, 'Urdu' name, 'اردو' native FROM dual UNION ALL
    SELECT 'uz' id, 'uzb' iso3, 'Uzbek' name, 'O''zbek' native FROM dual UNION ALL
    SELECT 've' id, 'ven' iso3, 'Venda' name, 'Tshivenda' native FROM dual UNION ALL
    SELECT 'vi' id, 'vie' iso3, 'Vietnamese' name, 'Tiếng Việt' native FROM dual UNION ALL
    SELECT 'vo' id, 'vol' iso3, 'Volapük' name, 'Volapük' native FROM dual UNION ALL
    SELECT 'wa' id, 'wln' iso3, 'Walloon' name, 'walon' native FROM dual UNION ALL
    SELECT 'wo' id, 'wol' iso3, 'Wolof' name, 'Wollof' native FROM dual UNION ALL
    SELECT 'xh' id, 'xho' iso3, 'Xhosa' name, 'isiXhosa' native FROM dual UNION ALL
    SELECT 'yi' id, 'yid' iso3, 'Yiddish' name, 'ייִדיש' native FROM dual UNION ALL
    SELECT 'yo' id, 'yor' iso3, 'Yoruba' name, 'Yorùbá' native FROM dual UNION ALL
    SELECT 'za' id, 'zha' iso3, 'Zhuang' name, 'Saɯ cueŋƅ' native FROM dual UNION ALL
    SELECT 'zh' id, 'zho' iso3, 'Chinese' name, '中文' native FROM dual UNION ALL
    SELECT 'zu' id, 'zul' iso3, 'Zulu' name, 'isiZulu' native FROM dual
) src
ON (tgt.id = src.id)
WHEN NOT MATCHED THEN
    INSERT (id, iso3, name, native, active)
    VALUES (src.id, src.iso3, src.name, src.native, 'Y')
WHEN MATCHED THEN
    UPDATE SET
        tgt.iso3 = src.iso3,
        tgt.name = src.name,
        tgt.native = src.native;
