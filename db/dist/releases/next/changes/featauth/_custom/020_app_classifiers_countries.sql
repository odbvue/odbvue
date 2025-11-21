-- liquibase formatted sql
-- changeset  SqlCl:1763704887055 stripComments:false logicalFilePath:featauth\_custom\020_app_classifiers_countries.sql
-- sqlcl_snapshot dist\releases\next\changes\featauth\_custom\020_app_classifiers_countries.sql:null:null:custom

MERGE INTO app_countries tgt
USING (
    SELECT 'AD' id, 'AND' iso3, 'Andorra' name, 'Andorra' native FROM dual UNION ALL
    SELECT 'AE' id, 'ARE' iso3, 'United Arab Emirates' name, 'الإمارات العربية المتحدة' native FROM dual UNION ALL
    SELECT 'AF' id, 'AFG' iso3, 'Afghanistan' name, 'افغانستان' native FROM dual UNION ALL
    SELECT 'AG' id, 'ATG' iso3, 'Antigua and Barbuda' name, 'Antigua and Barbuda' native FROM dual UNION ALL
    SELECT 'AI' id, 'AIA' iso3, 'Anguilla' name, 'Anguilla' native FROM dual UNION ALL
    SELECT 'AL' id, 'ALB' iso3, 'Albania' name, 'Shqipëria' native FROM dual UNION ALL
    SELECT 'AM' id, 'ARM' iso3, 'Armenia' name, 'Հայաստան' native FROM dual UNION ALL
    SELECT 'AO' id, 'AGO' iso3, 'Angola' name, 'Angola' native FROM dual UNION ALL
    SELECT 'AQ' id, 'ATA' iso3, 'Antarctica' name, 'Antarctica' native FROM dual UNION ALL
    SELECT 'AR' id, 'ARG' iso3, 'Argentina' name, 'Argentina' native FROM dual UNION ALL
    SELECT 'AS' id, 'ASM' iso3, 'American Samoa' name, 'American Samoa' native FROM dual UNION ALL
    SELECT 'AT' id, 'AUT' iso3, 'Austria' name, 'Österreich' native FROM dual UNION ALL
    SELECT 'AU' id, 'AUS' iso3, 'Australia' name, 'Australia' native FROM dual UNION ALL
    SELECT 'AW' id, 'ABW' iso3, 'Aruba' name, 'Aruba' native FROM dual UNION ALL
    SELECT 'AX' id, 'ALA' iso3, 'Åland Islands' name, 'Åland' native FROM dual UNION ALL
    SELECT 'AZ' id, 'AZE' iso3, 'Azerbaijan' name, 'Azərbaycan' native FROM dual UNION ALL
    SELECT 'BA' id, 'BIH' iso3, 'Bosnia and Herzegovina' name, 'Bosna i Hercegovina' native FROM dual UNION ALL
    SELECT 'BB' id, 'BRB' iso3, 'Barbados' name, 'Barbados' native FROM dual UNION ALL
    SELECT 'BD' id, 'BGD' iso3, 'Bangladesh' name, 'বাংলাদেশ' native FROM dual UNION ALL
    SELECT 'BE' id, 'BEL' iso3, 'Belgium' name, 'België' native FROM dual UNION ALL
    SELECT 'BF' id, 'BFA' iso3, 'Burkina Faso' name, 'Burkina Faso' native FROM dual UNION ALL
    SELECT 'BG' id, 'BGR' iso3, 'Bulgaria' name, 'България' native FROM dual UNION ALL
    SELECT 'BH' id, 'BHR' iso3, 'Bahrain' name, 'البحرين' native FROM dual UNION ALL
    SELECT 'BI' id, 'BDI' iso3, 'Burundi' name, 'Burundi' native FROM dual UNION ALL
    SELECT 'BJ' id, 'BEN' iso3, 'Benin' name, 'Bénin' native FROM dual UNION ALL
    SELECT 'BL' id, 'BLM' iso3, 'Saint Barthélemy' name, 'Saint-Barthélemy' native FROM dual UNION ALL
    SELECT 'BM' id, 'BMU' iso3, 'Bermuda' name, 'Bermuda' native FROM dual UNION ALL
    SELECT 'BN' id, 'BRN' iso3, 'Brunei' name, 'Brunei Darussalam' native FROM dual UNION ALL
    SELECT 'BO' id, 'BOL' iso3, 'Bolivia' name, 'Bolivia' native FROM dual UNION ALL
    SELECT 'BQ' id, 'BES' iso3, 'Caribbean Netherlands' name, 'Bonaire, Sint Eustatius en Saba' native FROM dual UNION ALL
    SELECT 'BR' id, 'BRA' iso3, 'Brazil' name, 'Brasil' native FROM dual UNION ALL
    SELECT 'BS' id, 'BHS' iso3, 'Bahamas' name, 'Bahamas' native FROM dual UNION ALL
    SELECT 'BT' id, 'BTN' iso3, 'Bhutan' name, 'ཕོ་བྲང་' native FROM dual UNION ALL
    SELECT 'BV' id, 'BVT' iso3, 'Bouvet Island' name, 'Bouvetøya' native FROM dual UNION ALL
    SELECT 'BW' id, 'BWA' iso3, 'Botswana' name, 'Botswana' native FROM dual UNION ALL
    SELECT 'BY' id, 'BLR' iso3, 'Belarus' name, 'Беларусь' native FROM dual UNION ALL
    SELECT 'BZ' id, 'BLZ' iso3, 'Belize' name, 'Belize' native FROM dual UNION ALL
    SELECT 'CA' id, 'CAN' iso3, 'Canada' name, 'Canada' native FROM dual UNION ALL
    SELECT 'CC' id, 'CCK' iso3, 'Cocos (Keeling) Islands' name, 'Cocos Islands' native FROM dual UNION ALL
    SELECT 'CD' id, 'COD' iso3, 'Democratic Republic of the Congo' name, 'République Démocratique du Congo' native FROM dual UNION ALL
    SELECT 'CF' id, 'CAF' iso3, 'Central African Republic' name, 'République Centrafricaine' native FROM dual UNION ALL
    SELECT 'CG' id, 'COG' iso3, 'Republic of the Congo' name, 'République du Congo' native FROM dual UNION ALL
    SELECT 'CH' id, 'CHE' iso3, 'Switzerland' name, 'Schweiz' native FROM dual UNION ALL
    SELECT 'CI' id, 'CIV' iso3, 'Côte d''Ivoire' name, 'Côte d''Ivoire' native FROM dual UNION ALL
    SELECT 'CK' id, 'COK' iso3, 'Cook Islands' name, 'Cook Islands' native FROM dual UNION ALL
    SELECT 'CL' id, 'CHL' iso3, 'Chile' name, 'Chile' native FROM dual UNION ALL
    SELECT 'CM' id, 'CMR' iso3, 'Cameroon' name, 'Cameroun' native FROM dual UNION ALL
    SELECT 'CN' id, 'CHN' iso3, 'China' name, '中国' native FROM dual UNION ALL
    SELECT 'CO' id, 'COL' iso3, 'Colombia' name, 'Colombia' native FROM dual UNION ALL
    SELECT 'CR' id, 'CRI' iso3, 'Costa Rica' name, 'Costa Rica' native FROM dual UNION ALL
    SELECT 'CU' id, 'CUB' iso3, 'Cuba' name, 'Cuba' native FROM dual UNION ALL
    SELECT 'CV' id, 'CPV' iso3, 'Cape Verde' name, 'Cabo Verde' native FROM dual UNION ALL
    SELECT 'CW' id, 'CUW' iso3, 'Curaçao' name, 'Curaçao' native FROM dual UNION ALL
    SELECT 'CX' id, 'CXR' iso3, 'Christmas Island' name, 'Christmas Island' native FROM dual UNION ALL
    SELECT 'CY' id, 'CYP' iso3, 'Cyprus' name, 'Κύπρος' native FROM dual UNION ALL
    SELECT 'CZ' id, 'CZE' iso3, 'Czechia' name, 'Česko' native FROM dual UNION ALL
    SELECT 'DE' id, 'DEU' iso3, 'Germany' name, 'Deutschland' native FROM dual UNION ALL
    SELECT 'DJ' id, 'DJI' iso3, 'Djibouti' name, 'Djibouti' native FROM dual UNION ALL
    SELECT 'DK' id, 'DNK' iso3, 'Denmark' name, 'Danmark' native FROM dual UNION ALL
    SELECT 'DM' id, 'DMA' iso3, 'Dominica' name, 'Dominica' native FROM dual UNION ALL
    SELECT 'DO' id, 'DOM' iso3, 'Dominican Republic' name, 'República Dominicana' native FROM dual UNION ALL
    SELECT 'DZ' id, 'DZA' iso3, 'Algeria' name, 'الجزائر' native FROM dual UNION ALL
    SELECT 'EC' id, 'ECU' iso3, 'Ecuador' name, 'Ecuador' native FROM dual UNION ALL
    SELECT 'EE' id, 'EST' iso3, 'Estonia' name, 'Eesti' native FROM dual UNION ALL
    SELECT 'EG' id, 'EGY' iso3, 'Egypt' name, 'مصر' native FROM dual UNION ALL
    SELECT 'EH' id, 'ESH' iso3, 'Western Sahara' name, 'الصحراء الغربية' native FROM dual UNION ALL
    SELECT 'ER' id, 'ERI' iso3, 'Eritrea' name, 'Eritrea' native FROM dual UNION ALL
    SELECT 'ES' id, 'ESP' iso3, 'Spain' name, 'España' native FROM dual UNION ALL
    SELECT 'ET' id, 'ETH' iso3, 'Ethiopia' name, 'ኢትዮጵያ' native FROM dual UNION ALL
    SELECT 'FI' id, 'FIN' iso3, 'Finland' name, 'Suomi' native FROM dual UNION ALL
    SELECT 'FJ' id, 'FJI' iso3, 'Fiji' name, 'Fiji' native FROM dual UNION ALL
    SELECT 'FK' id, 'FLK' iso3, 'Falkland Islands' name, 'Falkland Islands' native FROM dual UNION ALL
    SELECT 'FM' id, 'FSM' iso3, 'Micronesia' name, 'Micronesia' native FROM dual UNION ALL
    SELECT 'FO' id, 'FRO' iso3, 'Faroe Islands' name, 'Føroyar' native FROM dual UNION ALL
    SELECT 'FR' id, 'FRA' iso3, 'France' name, 'France' native FROM dual UNION ALL
    SELECT 'GA' id, 'GAB' iso3, 'Gabon' name, 'Gabon' native FROM dual UNION ALL
    SELECT 'GB' id, 'GBR' iso3, 'United Kingdom' name, 'United Kingdom' native FROM dual UNION ALL
    SELECT 'GD' id, 'GRD' iso3, 'Grenada' name, 'Grenada' native FROM dual UNION ALL
    SELECT 'GE' id, 'GEO' iso3, 'Georgia' name, 'საქართველო' native FROM dual UNION ALL
    SELECT 'GF' id, 'GUF' iso3, 'French Guiana' name, 'Guyane française' native FROM dual UNION ALL
    SELECT 'GG' id, 'GGY' iso3, 'Guernsey' name, 'Guernsey' native FROM dual UNION ALL
    SELECT 'GH' id, 'GHA' iso3, 'Ghana' name, 'Ghana' native FROM dual UNION ALL
    SELECT 'GI' id, 'GIB' iso3, 'Gibraltar' name, 'Gibraltar' native FROM dual UNION ALL
    SELECT 'GL' id, 'GRL' iso3, 'Greenland' name, 'Kalaallit Nunaat' native FROM dual UNION ALL
    SELECT 'GM' id, 'GMB' iso3, 'Gambia' name, 'Gambia' native FROM dual UNION ALL
    SELECT 'GN' id, 'GIN' iso3, 'Guinea' name, 'Guinée' native FROM dual UNION ALL
    SELECT 'GP' id, 'GLP' iso3, 'Guadeloupe' name, 'Guadeloupe' native FROM dual UNION ALL
    SELECT 'GQ' id, 'GNQ' iso3, 'Equatorial Guinea' name, 'Guinea Ecuatorial' native FROM dual UNION ALL
    SELECT 'GR' id, 'GRC' iso3, 'Greece' name, 'Ελλάδα' native FROM dual UNION ALL
    SELECT 'GS' id, 'SGS' iso3, 'South Georgia and the South Sandwich Islands' name, 'South Georgia' native FROM dual UNION ALL
    SELECT 'GT' id, 'GTM' iso3, 'Guatemala' name, 'Guatemala' native FROM dual UNION ALL
    SELECT 'GU' id, 'GUM' iso3, 'Guam' name, 'Guam' native FROM dual UNION ALL
    SELECT 'GW' id, 'GNB' iso3, 'Guinea-Bissau' name, 'Guiné-Bissau' native FROM dual UNION ALL
    SELECT 'GY' id, 'GUY' iso3, 'Guyana' name, 'Guyana' native FROM dual UNION ALL
    SELECT 'HK' id, 'HKG' iso3, 'Hong Kong' name, '香港' native FROM dual UNION ALL
    SELECT 'HM' id, 'HMD' iso3, 'Heard Island and McDonald Islands' name, 'Heard Island' native FROM dual UNION ALL
    SELECT 'HN' id, 'HND' iso3, 'Honduras' name, 'Honduras' native FROM dual UNION ALL
    SELECT 'HR' id, 'HRV' iso3, 'Croatia' name, 'Hrvatska' native FROM dual UNION ALL
    SELECT 'HT' id, 'HTI' iso3, 'Haiti' name, 'Haïti' native FROM dual UNION ALL
    SELECT 'HU' id, 'HUN' iso3, 'Hungary' name, 'Magyarország' native FROM dual UNION ALL
    SELECT 'ID' id, 'IDN' iso3, 'Indonesia' name, 'Indonesia' native FROM dual UNION ALL
    SELECT 'IE' id, 'IRL' iso3, 'Ireland' name, 'Éire' native FROM dual UNION ALL
    SELECT 'IL' id, 'ISR' iso3, 'Israel' name, 'ישראל' native FROM dual UNION ALL
    SELECT 'IM' id, 'IMN' iso3, 'Isle of Man' name, 'Isle of Man' native FROM dual UNION ALL
    SELECT 'IN' id, 'IND' iso3, 'India' name, 'भारत' native FROM dual UNION ALL
    SELECT 'IO' id, 'IOT' iso3, 'British Indian Ocean Territory' name, 'British Indian Ocean Territory' native FROM dual UNION ALL
    SELECT 'IQ' id, 'IRQ' iso3, 'Iraq' name, 'العراق' native FROM dual UNION ALL
    SELECT 'IR' id, 'IRN' iso3, 'Iran' name, 'ایران' native FROM dual UNION ALL
    SELECT 'IS' id, 'ISL' iso3, 'Iceland' name, 'Ísland' native FROM dual UNION ALL
    SELECT 'IT' id, 'ITA' iso3, 'Italy' name, 'Italia' native FROM dual UNION ALL
    SELECT 'JE' id, 'JEY' iso3, 'Jersey' name, 'Jersey' native FROM dual UNION ALL
    SELECT 'JM' id, 'JAM' iso3, 'Jamaica' name, 'Jamaica' native FROM dual UNION ALL
    SELECT 'JO' id, 'JOR' iso3, 'Jordan' name, 'الأردن' native FROM dual UNION ALL
    SELECT 'JP' id, 'JPN' iso3, 'Japan' name, '日本' native FROM dual UNION ALL
    SELECT 'KE' id, 'KEN' iso3, 'Kenya' name, 'Kenya' native FROM dual UNION ALL
    SELECT 'KG' id, 'KGZ' iso3, 'Kyrgyzstan' name, 'Кыргызстан' native FROM dual UNION ALL
    SELECT 'KH' id, 'KHM' iso3, 'Cambodia' name, 'កម្ពុជា' native FROM dual UNION ALL
    SELECT 'KI' id, 'KIR' iso3, 'Kiribati' name, 'Kiribati' native FROM dual UNION ALL
    SELECT 'KM' id, 'COM' iso3, 'Comoros' name, 'Comores' native FROM dual UNION ALL
    SELECT 'KN' id, 'KNA' iso3, 'Saint Kitts and Nevis' name, 'Saint Kitts and Nevis' native FROM dual UNION ALL
    SELECT 'KP' id, 'PRK' iso3, 'North Korea' name, '조선민주주의인민공화국' native FROM dual UNION ALL
    SELECT 'KR' id, 'KOR' iso3, 'South Korea' name, '대한민국' native FROM dual UNION ALL
    SELECT 'KW' id, 'KWT' iso3, 'Kuwait' name, 'الكويت' native FROM dual UNION ALL
    SELECT 'KY' id, 'CYM' iso3, 'Cayman Islands' name, 'Cayman Islands' native FROM dual UNION ALL
    SELECT 'KZ' id, 'KAZ' iso3, 'Kazakhstan' name, 'Қазақстан' native FROM dual UNION ALL
    SELECT 'LA' id, 'LAO' iso3, 'Laos' name, 'ລາວ' native FROM dual UNION ALL
    SELECT 'LB' id, 'LBN' iso3, 'Lebanon' name, 'لبنان' native FROM dual UNION ALL
    SELECT 'LC' id, 'LCA' iso3, 'Saint Lucia' name, 'Saint Lucia' native FROM dual UNION ALL
    SELECT 'LI' id, 'LIE' iso3, 'Liechtenstein' name, 'Liechtenstein' native FROM dual UNION ALL
    SELECT 'LK' id, 'LKA' iso3, 'Sri Lanka' name, 'ශ්‍රී ලංකා' native FROM dual UNION ALL
    SELECT 'LR' id, 'LBR' iso3, 'Liberia' name, 'Liberia' native FROM dual UNION ALL
    SELECT 'LS' id, 'LSO' iso3, 'Lesotho' name, 'Lesotho' native FROM dual UNION ALL
    SELECT 'LT' id, 'LTU' iso3, 'Lithuania' name, 'Lietuva' native FROM dual UNION ALL
    SELECT 'LU' id, 'LUX' iso3, 'Luxembourg' name, 'Luxembourg' native FROM dual UNION ALL
    SELECT 'LV' id, 'LVA' iso3, 'Latvia' name, 'Latvija' native FROM dual UNION ALL
    SELECT 'LY' id, 'LBY' iso3, 'Libya' name, 'ليبيا' native FROM dual UNION ALL
    SELECT 'MA' id, 'MAR' iso3, 'Morocco' name, 'المغرب' native FROM dual UNION ALL
    SELECT 'MC' id, 'MCO' iso3, 'Monaco' name, 'Monaco' native FROM dual UNION ALL
    SELECT 'MD' id, 'MDA' iso3, 'Moldova' name, 'Moldova' native FROM dual UNION ALL
    SELECT 'ME' id, 'MNE' iso3, 'Montenegro' name, 'Crna Gora' native FROM dual UNION ALL
    SELECT 'MF' id, 'MAF' iso3, 'Saint Martin' name, 'Saint-Martin' native FROM dual UNION ALL
    SELECT 'MG' id, 'MDG' iso3, 'Madagascar' name, 'Madagascar' native FROM dual UNION ALL
    SELECT 'MH' id, 'MHL' iso3, 'Marshall Islands' name, 'Marshall Islands' native FROM dual UNION ALL
    SELECT 'MK' id, 'MKD' iso3, 'North Macedonia' name, 'Македонија' native FROM dual UNION ALL
    SELECT 'ML' id, 'MLI' iso3, 'Mali' name, 'Mali' native FROM dual UNION ALL
    SELECT 'MM' id, 'MMR' iso3, 'Myanmar' name, 'မြန်မာ' native FROM dual UNION ALL
    SELECT 'MN' id, 'MNG' iso3, 'Mongolia' name, 'Монгол' native FROM dual UNION ALL
    SELECT 'MO' id, 'MAC' iso3, 'Macao' name, '澳門' native FROM dual UNION ALL
    SELECT 'MP' id, 'MNP' iso3, 'Northern Mariana Islands' name, 'Northern Mariana Islands' native FROM dual UNION ALL
    SELECT 'MQ' id, 'MTQ' iso3, 'Martinique' name, 'Martinique' native FROM dual UNION ALL
    SELECT 'MR' id, 'MRT' iso3, 'Mauritania' name, 'موريتانيا' native FROM dual UNION ALL
    SELECT 'MS' id, 'MSR' iso3, 'Montserrat' name, 'Montserrat' native FROM dual UNION ALL
    SELECT 'MT' id, 'MLT' iso3, 'Malta' name, 'Malta' native FROM dual UNION ALL
    SELECT 'MU' id, 'MUS' iso3, 'Mauritius' name, 'Mauritius' native FROM dual UNION ALL
    SELECT 'MV' id, 'MDV' iso3, 'Maldives' name, 'ހިވެހިރާއްޖެ' native FROM dual UNION ALL
    SELECT 'MW' id, 'MWI' iso3, 'Malawi' name, 'Malawi' native FROM dual UNION ALL
    SELECT 'MX' id, 'MEX' iso3, 'Mexico' name, 'México' native FROM dual UNION ALL
    SELECT 'MY' id, 'MYS' iso3, 'Malaysia' name, 'Malaysia' native FROM dual UNION ALL
    SELECT 'MZ' id, 'MOZ' iso3, 'Mozambique' name, 'Moçambique' native FROM dual UNION ALL
    SELECT 'NA' id, 'NAM' iso3, 'Namibia' name, 'Namibia' native FROM dual UNION ALL
    SELECT 'NC' id, 'NCL' iso3, 'New Caledonia' name, 'Nouvelle-Calédonie' native FROM dual UNION ALL
    SELECT 'NE' id, 'NER' iso3, 'Niger' name, 'Niger' native FROM dual UNION ALL
    SELECT 'NF' id, 'NFK' iso3, 'Norfolk Island' name, 'Norfolk Island' native FROM dual UNION ALL
    SELECT 'NG' id, 'NGA' iso3, 'Nigeria' name, 'Nigeria' native FROM dual UNION ALL
    SELECT 'NI' id, 'NIC' iso3, 'Nicaragua' name, 'Nicaragua' native FROM dual UNION ALL
    SELECT 'NL' id, 'NLD' iso3, 'Netherlands' name, 'Nederland' native FROM dual UNION ALL
    SELECT 'NO' id, 'NOR' iso3, 'Norway' name, 'Norge' native FROM dual UNION ALL
    SELECT 'NP' id, 'NPL' iso3, 'Nepal' name, 'नेपाल' native FROM dual UNION ALL
    SELECT 'NR' id, 'NRU' iso3, 'Nauru' name, 'Nauru' native FROM dual UNION ALL
    SELECT 'NU' id, 'NIU' iso3, 'Niue' name, 'Niue' native FROM dual UNION ALL
    SELECT 'NZ' id, 'NZL' iso3, 'New Zealand' name, 'New Zealand' native FROM dual UNION ALL
    SELECT 'OM' id, 'OMN' iso3, 'Oman' name, 'عمان' native FROM dual UNION ALL
    SELECT 'PA' id, 'PAN' iso3, 'Panama' name, 'Panamá' native FROM dual UNION ALL
    SELECT 'PE' id, 'PER' iso3, 'Peru' name, 'Perú' native FROM dual UNION ALL
    SELECT 'PF' id, 'PYF' iso3, 'French Polynesia' name, 'Polynésie française' native FROM dual UNION ALL
    SELECT 'PG' id, 'PNG' iso3, 'Papua New Guinea' name, 'Papua New Guinea' native FROM dual UNION ALL
    SELECT 'PH' id, 'PHL' iso3, 'Philippines' name, 'Pilipinas' native FROM dual UNION ALL
    SELECT 'PK' id, 'PAK' iso3, 'Pakistan' name, 'پاکستان' native FROM dual UNION ALL
    SELECT 'PL' id, 'POL' iso3, 'Poland' name, 'Polska' native FROM dual UNION ALL
    SELECT 'PM' id, 'SPM' iso3, 'Saint Pierre and Miquelon' name, 'Saint-Pierre-et-Miquelon' native FROM dual UNION ALL
    SELECT 'PN' id, 'PCN' iso3, 'Pitcairn Islands' name, 'Pitcairn Islands' native FROM dual UNION ALL
    SELECT 'PR' id, 'PRI' iso3, 'Puerto Rico' name, 'Puerto Rico' native FROM dual UNION ALL
    SELECT 'PS' id, 'PSE' iso3, 'Palestine' name, 'فلسطين' native FROM dual UNION ALL
    SELECT 'PT' id, 'PRT' iso3, 'Portugal' name, 'Portugal' native FROM dual UNION ALL
    SELECT 'PW' id, 'PLW' iso3, 'Palau' name, 'Palau' native FROM dual UNION ALL
    SELECT 'PY' id, 'PRY' iso3, 'Paraguay' name, 'Paraguay' native FROM dual UNION ALL
    SELECT 'QA' id, 'QAT' iso3, 'Qatar' name, 'قطر' native FROM dual UNION ALL
    SELECT 'RE' id, 'REU' iso3, 'Réunion' name, 'Réunion' native FROM dual UNION ALL
    SELECT 'RO' id, 'ROU' iso3, 'Romania' name, 'România' native FROM dual UNION ALL
    SELECT 'RS' id, 'SRB' iso3, 'Serbia' name, 'Србија' native FROM dual UNION ALL
    SELECT 'RU' id, 'RUS' iso3, 'Russia' name, 'Россия' native FROM dual UNION ALL
    SELECT 'RW' id, 'RWA' iso3, 'Rwanda' name, 'Rwanda' native FROM dual UNION ALL
    SELECT 'SA' id, 'SAU' iso3, 'Saudi Arabia' name, 'المملكة العربية السعودية' native FROM dual UNION ALL
    SELECT 'SB' id, 'SLB' iso3, 'Solomon Islands' name, 'Solomon Islands' native FROM dual UNION ALL
    SELECT 'SC' id, 'SYC' iso3, 'Seychelles' name, 'Seychelles' native FROM dual UNION ALL
    SELECT 'SD' id, 'SDN' iso3, 'Sudan' name, 'السودان' native FROM dual UNION ALL
    SELECT 'SE' id, 'SWE' iso3, 'Sweden' name, 'Sverige' native FROM dual UNION ALL
    SELECT 'SG' id, 'SGP' iso3, 'Singapore' name, 'Singapore' native FROM dual UNION ALL
    SELECT 'SH' id, 'SHN' iso3, 'Saint Helena' name, 'Saint Helena' native FROM dual UNION ALL
    SELECT 'SI' id, 'SVN' iso3, 'Slovenia' name, 'Slovenija' native FROM dual UNION ALL
    SELECT 'SJ' id, 'SJM' iso3, 'Svalbard and Jan Mayen' name, 'Svalbard og Jan Mayen' native FROM dual UNION ALL
    SELECT 'SK' id, 'SVK' iso3, 'Slovakia' name, 'Slovensko' native FROM dual UNION ALL
    SELECT 'SL' id, 'SLE' iso3, 'Sierra Leone' name, 'Sierra Leone' native FROM dual UNION ALL
    SELECT 'SM' id, 'SMR' iso3, 'San Marino' name, 'San Marino' native FROM dual UNION ALL
    SELECT 'SN' id, 'SEN' iso3, 'Senegal' name, 'Sénégal' native FROM dual UNION ALL
    SELECT 'SO' id, 'SOM' iso3, 'Somalia' name, 'Soomaaliya' native FROM dual UNION ALL
    SELECT 'SR' id, 'SUR' iso3, 'Suriname' name, 'Suriname' native FROM dual UNION ALL
    SELECT 'SS' id, 'SSD' iso3, 'South Sudan' name, 'South Sudan' native FROM dual UNION ALL
    SELECT 'ST' id, 'STP' iso3, 'São Tomé and Príncipe' name, 'São Tomé and Príncipe' native FROM dual UNION ALL
    SELECT 'SV' id, 'SLV' iso3, 'El Salvador' name, 'El Salvador' native FROM dual UNION ALL
    SELECT 'SX' id, 'SXM' iso3, 'Sint Maarten' name, 'Sint Maarten' native FROM dual UNION ALL
    SELECT 'SY' id, 'SYR' iso3, 'Syria' name, 'سوريا' native FROM dual UNION ALL
    SELECT 'SZ' id, 'SWZ' iso3, 'Eswatini' name, 'Eswatini' native FROM dual UNION ALL
    SELECT 'TC' id, 'TCA' iso3, 'Turks and Caicos Islands' name, 'Turks and Caicos Islands' native FROM dual UNION ALL
    SELECT 'TD' id, 'TCD' iso3, 'Chad' name, 'Tchad' native FROM dual UNION ALL
    SELECT 'TF' id, 'ATF' iso3, 'French Southern Territories' name, 'Terres australes françaises' native FROM dual UNION ALL
    SELECT 'TG' id, 'TGO' iso3, 'Togo' name, 'Togo' native FROM dual UNION ALL
    SELECT 'TH' id, 'THA' iso3, 'Thailand' name, 'ไทย' native FROM dual UNION ALL
    SELECT 'TJ' id, 'TJK' iso3, 'Tajikistan' name, 'Тоҷикистон' native FROM dual UNION ALL
    SELECT 'TK' id, 'TKL' iso3, 'Tokelau' name, 'Tokelau' native FROM dual UNION ALL
    SELECT 'TL' id, 'TLS' iso3, 'Timor-Leste' name, 'Timor-Leste' native FROM dual UNION ALL
    SELECT 'TM' id, 'TKM' iso3, 'Turkmenistan' name, 'Türkmenistan' native FROM dual UNION ALL
    SELECT 'TN' id, 'TUN' iso3, 'Tunisia' name, 'تونس' native FROM dual UNION ALL
    SELECT 'TO' id, 'TON' iso3, 'Tonga' name, 'Tonga' native FROM dual UNION ALL
    SELECT 'TR' id, 'TUR' iso3, 'Turkey' name, 'Türkiye' native FROM dual UNION ALL
    SELECT 'TT' id, 'TTO' iso3, 'Trinidad and Tobago' name, 'Trinidad and Tobago' native FROM dual UNION ALL
    SELECT 'TV' id, 'TUV' iso3, 'Tuvalu' name, 'Tuvalu' native FROM dual UNION ALL
    SELECT 'TW' id, 'TWN' iso3, 'Taiwan' name, '臺灣' native FROM dual UNION ALL
    SELECT 'TZ' id, 'TZA' iso3, 'Tanzania' name, 'Tanzania' native FROM dual UNION ALL
    SELECT 'UA' id, 'UKR' iso3, 'Ukraine' name, 'Україна' native FROM dual UNION ALL
    SELECT 'UG' id, 'UGA' iso3, 'Uganda' name, 'Uganda' native FROM dual UNION ALL
    SELECT 'UM' id, 'UMI' iso3, 'United States Minor Outlying Islands' name, 'United States Minor Outlying Islands' native FROM dual UNION ALL
    SELECT 'US' id, 'USA' iso3, 'United States' name, 'United States' native FROM dual UNION ALL
    SELECT 'UY' id, 'URY' iso3, 'Uruguay' name, 'Uruguay' native FROM dual UNION ALL
    SELECT 'UZ' id, 'UZB' iso3, 'Uzbekistan' name, 'O''zbekiston' native FROM dual UNION ALL
    SELECT 'VA' id, 'VAT' iso3, 'Vatican City' name, 'Vatican City' native FROM dual UNION ALL
    SELECT 'VC' id, 'VCT' iso3, 'Saint Vincent and the Grenadines' name, 'Saint Vincent and the Grenadines' native FROM dual UNION ALL
    SELECT 'VE' id, 'VEN' iso3, 'Venezuela' name, 'Venezuela' native FROM dual UNION ALL
    SELECT 'VG' id, 'VGB' iso3, 'British Virgin Islands' name, 'British Virgin Islands' native FROM dual UNION ALL
    SELECT 'VI' id, 'VIR' iso3, 'Virgin Islands' name, 'Virgin Islands' native FROM dual UNION ALL
    SELECT 'VN' id, 'VNM' iso3, 'Vietnam' name, 'Việt Nam' native FROM dual UNION ALL
    SELECT 'VU' id, 'VUT' iso3, 'Vanuatu' name, 'Vanuatu' native FROM dual UNION ALL
    SELECT 'WF' id, 'WLF' iso3, 'Wallis and Futuna' name, 'Wallis and Futuna' native FROM dual UNION ALL
    SELECT 'WS' id, 'WSM' iso3, 'Samoa' name, 'Samoa' native FROM dual UNION ALL
    SELECT 'YE' id, 'YEM' iso3, 'Yemen' name, 'اليمن' native FROM dual UNION ALL
    SELECT 'YT' id, 'MYT' iso3, 'Mayotte' name, 'Mayotte' native FROM dual UNION ALL
    SELECT 'ZA' id, 'ZAF' iso3, 'South Africa' name, 'South Africa' native FROM dual UNION ALL
    SELECT 'ZM' id, 'ZMB' iso3, 'Zambia' name, 'Zambia' native FROM dual UNION ALL
    SELECT 'ZW' id, 'ZWE' iso3, 'Zimbabwe' name, 'Zimbabwe' native FROM dual
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

