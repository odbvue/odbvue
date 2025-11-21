-- liquibase formatted sql
-- changeset  SqlCl:1763705516183 stripComments:false logicalFilePath:featauth\_custom\020_app_classifiers_currencies.sql
-- sqlcl_snapshot dist\releases\next\changes\featauth\_custom\020_app_classifiers_currencies.sql:null:null:custom

-- Repeatable inserts for app_currencies table (ISO 4217: 180 currency codes)
MERGE INTO app_currencies tgt
USING (
    SELECT 'AED' id, 'United Arab Emirates Dirham' name, 'د.إ' symbol FROM dual UNION ALL
    SELECT 'AFN' id, 'Afghan Afghani' name, '؋' symbol FROM dual UNION ALL
    SELECT 'ALL' id, 'Albanian Lek' name, 'L' symbol FROM dual UNION ALL
    SELECT 'AMD' id, 'Armenian Dram' name, '֏' symbol FROM dual UNION ALL
    SELECT 'ANG' id, 'Netherlands Antillean Guilder' name, 'ƒ' symbol FROM dual UNION ALL
    SELECT 'AOA' id, 'Angolan Kwanza' name, 'Kz' symbol FROM dual UNION ALL
    SELECT 'ARS' id, 'Argentine Peso' name, '$' symbol FROM dual UNION ALL
    SELECT 'AUD' id, 'Australian Dollar' name, 'A$' symbol FROM dual UNION ALL
    SELECT 'AWG' id, 'Aruban Florin' name, 'ƒ' symbol FROM dual UNION ALL
    SELECT 'AZN' id, 'Azerbaijani Manat' name, '₼' symbol FROM dual UNION ALL
    SELECT 'BAM' id, 'Bosnia and Herzegovina Convertible Mark' name, 'KM' symbol FROM dual UNION ALL
    SELECT 'BBD' id, 'Barbadian Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'BDT' id, 'Bangladeshi Taka' name, '৳' symbol FROM dual UNION ALL
    SELECT 'BGN' id, 'Bulgarian Lev' name, 'лв' symbol FROM dual UNION ALL
    SELECT 'BHD' id, 'Bahraini Dinar' name, '.د.ب' symbol FROM dual UNION ALL
    SELECT 'BIF' id, 'Burundian Franc' name, 'FBu' symbol FROM dual UNION ALL
    SELECT 'BMD' id, 'Bermudian Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'BND' id, 'Brunei Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'BOB' id, 'Bolivian Boliviano' name, 'Bs.' symbol FROM dual UNION ALL
    SELECT 'BRL' id, 'Brazilian Real' name, 'R$' symbol FROM dual UNION ALL
    SELECT 'BSD' id, 'Bahamian Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'BTC' id, 'Bitcoin' name, '₿' symbol FROM dual UNION ALL
    SELECT 'BTN' id, 'Bhutanese Ngultrum' name, 'Nu.' symbol FROM dual UNION ALL
    SELECT 'BWP' id, 'Botswanan Pula' name, 'P' symbol FROM dual UNION ALL
    SELECT 'BYN' id, 'Belarusian Ruble' name, 'Br' symbol FROM dual UNION ALL
    SELECT 'BZD' id, 'Belize Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'CAD' id, 'Canadian Dollar' name, 'C$' symbol FROM dual UNION ALL
    SELECT 'CDF' id, 'Congolese Franc' name, 'FC' symbol FROM dual UNION ALL
    SELECT 'CHE' id, 'WIR Euro' name, 'CHE' symbol FROM dual UNION ALL
    SELECT 'CHF' id, 'Swiss Franc' name, 'CHF' symbol FROM dual UNION ALL
    SELECT 'CHW' id, 'WIR Franc' name, 'CHW' symbol FROM dual UNION ALL
    SELECT 'CLF' id, 'Chilean Unit of Account' name, 'UF' symbol FROM dual UNION ALL
    SELECT 'CLP' id, 'Chilean Peso' name, '$' symbol FROM dual UNION ALL
    SELECT 'CNH' id, 'Chinese Yuan (offshore)' name, '¥' symbol FROM dual UNION ALL
    SELECT 'CNY' id, 'Chinese Yuan' name, '¥' symbol FROM dual UNION ALL
    SELECT 'COP' id, 'Colombian Peso' name, '$' symbol FROM dual UNION ALL
    SELECT 'COU' id, 'Colombian Real Value Unit' name, 'COU' symbol FROM dual UNION ALL
    SELECT 'CRC' id, 'Costa Rican Colon' name, '₡' symbol FROM dual UNION ALL
    SELECT 'CUP' id, 'Cuban Peso' name, '₱' symbol FROM dual UNION ALL
    SELECT 'CVE' id, 'Cape Verdean Escudo' name, '$' symbol FROM dual UNION ALL
    SELECT 'CZK' id, 'Czech Koruna' name, 'Kč' symbol FROM dual UNION ALL
    SELECT 'DJF' id, 'Djiboutian Franc' name, 'Fdj' symbol FROM dual UNION ALL
    SELECT 'DKK' id, 'Danish Krone' name, 'kr' symbol FROM dual UNION ALL
    SELECT 'DOP' id, 'Dominican Peso' name, 'RD$' symbol FROM dual UNION ALL
    SELECT 'DZD' id, 'Algerian Dinar' name, 'د.ج' symbol FROM dual UNION ALL
    SELECT 'EGP' id, 'Egyptian Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'ERN' id, 'Eritrean Nakfa' name, 'Nfk' symbol FROM dual UNION ALL
    SELECT 'ETB' id, 'Ethiopian Birr' name, 'Br' symbol FROM dual UNION ALL
    SELECT 'EUR' id, 'Euro' name, '€' symbol FROM dual UNION ALL
    SELECT 'FJD' id, 'Fijian Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'FKP' id, 'Falkland Islander Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'GBP' id, 'British Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'GEL' id, 'Georgian Lari' name, '₾' symbol FROM dual UNION ALL
    SELECT 'GHS' id, 'Ghanaian Cedi' name, '₵' symbol FROM dual UNION ALL
    SELECT 'GIP' id, 'Gibraltar Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'GMD' id, 'Gambian Dalasi' name, 'D' symbol FROM dual UNION ALL
    SELECT 'GNF' id, 'Guinean Franc' name, 'FG' symbol FROM dual UNION ALL
    SELECT 'GTQ' id, 'Guatemalan Quetzal' name, 'Q' symbol FROM dual UNION ALL
    SELECT 'GYD' id, 'Guyanaese Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'HKD' id, 'Hong Kong Dollar' name, 'HK$' symbol FROM dual UNION ALL
    SELECT 'HNL' id, 'Honduran Lempira' name, 'L' symbol FROM dual UNION ALL
    SELECT 'HRK' id, 'Croatian Kuna' name, 'kn' symbol FROM dual UNION ALL
    SELECT 'HTG' id, 'Haitian Gourde' name, 'G' symbol FROM dual UNION ALL
    SELECT 'HUF' id, 'Hungarian Forint' name, 'Ft' symbol FROM dual UNION ALL
    SELECT 'IDR' id, 'Indonesian Rupiah' name, 'Rp' symbol FROM dual UNION ALL
    SELECT 'ILS' id, 'Israeli New Shekel' name, '₪' symbol FROM dual UNION ALL
    SELECT 'INR' id, 'Indian Rupee' name, '₹' symbol FROM dual UNION ALL
    SELECT 'IQD' id, 'Iraqi Dinar' name, 'ع.د' symbol FROM dual UNION ALL
    SELECT 'IRR' id, 'Iranian Rial' name, '﷼' symbol FROM dual UNION ALL
    SELECT 'ISK' id, 'Icelandic Króna' name, 'kr' symbol FROM dual UNION ALL
    SELECT 'JMD' id, 'Jamaican Dollar' name, 'J$' symbol FROM dual UNION ALL
    SELECT 'JOD' id, 'Jordanian Dinar' name, 'د.ا' symbol FROM dual UNION ALL
    SELECT 'JPY' id, 'Japanese Yen' name, '¥' symbol FROM dual UNION ALL
    SELECT 'KES' id, 'Kenyan Shilling' name, 'KSh' symbol FROM dual UNION ALL
    SELECT 'KGS' id, 'Kyrgyzstani Som' name, 'с' symbol FROM dual UNION ALL
    SELECT 'KHR' id, 'Cambodian Riel' name, '៛' symbol FROM dual UNION ALL
    SELECT 'KMF' id, 'Comorian Franc' name, 'CF' symbol FROM dual UNION ALL
    SELECT 'KPW' id, 'North Korean Won' name, '₩' symbol FROM dual UNION ALL
    SELECT 'KRW' id, 'South Korean Won' name, '₩' symbol FROM dual UNION ALL
    SELECT 'KWD' id, 'Kuwaiti Dinar' name, 'د.ك' symbol FROM dual UNION ALL
    SELECT 'KYD' id, 'Cayman Islands Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'KZT' id, 'Kazakhstani Tenge' name, '₸' symbol FROM dual UNION ALL
    SELECT 'LAK' id, 'Laotian Kip' name, '₭' symbol FROM dual UNION ALL
    SELECT 'LBP' id, 'Lebanese Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'LKR' id, 'Sri Lankan Rupee' name, 'Rs' symbol FROM dual UNION ALL
    SELECT 'LRD' id, 'Liberian Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'LSL' id, 'Lesotho Loti' name, 'L' symbol FROM dual UNION ALL
    SELECT 'LYD' id, 'Libyan Dinar' name, 'ل.د' symbol FROM dual UNION ALL
    SELECT 'MAD' id, 'Moroccan Dirham' name, 'د.م.' symbol FROM dual UNION ALL
    SELECT 'MDL' id, 'Moldovan Leu' name, 'L' symbol FROM dual UNION ALL
    SELECT 'MGA' id, 'Malagasy Ariary' name, 'Ar' symbol FROM dual UNION ALL
    SELECT 'MKD' id, 'Macedonian Denar' name, 'ден' symbol FROM dual UNION ALL
    SELECT 'MMK' id, 'Myanmar Kyat' name, 'K' symbol FROM dual UNION ALL
    SELECT 'MNT' id, 'Mongolian Tugrik' name, '₮' symbol FROM dual UNION ALL
    SELECT 'MOP' id, 'Macanese Pataca' name, 'P' symbol FROM dual UNION ALL
    SELECT 'MRU' id, 'Mauritanian Ouguiya' name, 'UM' symbol FROM dual UNION ALL
    SELECT 'MUR' id, 'Mauritian Rupee' name, '₨' symbol FROM dual UNION ALL
    SELECT 'MVR' id, 'Maldivian Rufiyaa' name, 'Rf' symbol FROM dual UNION ALL
    SELECT 'MWK' id, 'Malawian Kwacha' name, 'MK' symbol FROM dual UNION ALL
    SELECT 'MXN' id, 'Mexican Peso' name, '$' symbol FROM dual UNION ALL
    SELECT 'MXV' id, 'Mexican Silver Ounce' name, 'MXV' symbol FROM dual UNION ALL
    SELECT 'MYR' id, 'Malaysian Ringgit' name, 'RM' symbol FROM dual UNION ALL
    SELECT 'MZN' id, 'Mozambican Metical' name, 'MT' symbol FROM dual UNION ALL
    SELECT 'NAD' id, 'Namibian Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'NGN' id, 'Nigerian Naira' name, '₦' symbol FROM dual UNION ALL
    SELECT 'NIO' id, 'Nicaraguan Córdoba' name, 'C$' symbol FROM dual UNION ALL
    SELECT 'NOK' id, 'Norwegian Krone' name, 'kr' symbol FROM dual UNION ALL
    SELECT 'NPR' id, 'Nepalese Rupee' name, '₨' symbol FROM dual UNION ALL
    SELECT 'NZD' id, 'New Zealand Dollar' name, 'NZ$' symbol FROM dual UNION ALL
    SELECT 'OMR' id, 'Omani Rial' name, 'ر.ع.' symbol FROM dual UNION ALL
    SELECT 'PAB' id, 'Panamanian Balboa' name, 'B/.' symbol FROM dual UNION ALL
    SELECT 'PEN' id, 'Peruvian Nuevo Sol' name, 'S/' symbol FROM dual UNION ALL
    SELECT 'PGK' id, 'Papua New Guinean Kina' name, 'K' symbol FROM dual UNION ALL
    SELECT 'PHP' id, 'Philippine Piso' name, '₱' symbol FROM dual UNION ALL
    SELECT 'PKR' id, 'Pakistani Rupee' name, '₨' symbol FROM dual UNION ALL
    SELECT 'PLN' id, 'Polish Zloty' name, 'zł' symbol FROM dual UNION ALL
    SELECT 'PYG' id, 'Paraguayan Guarani' name, '₲' symbol FROM dual UNION ALL
    SELECT 'QAR' id, 'Qatari Rial' name, 'ر.ق' symbol FROM dual UNION ALL
    SELECT 'RON' id, 'Romanian Leu' name, 'lei' symbol FROM dual UNION ALL
    SELECT 'RSD' id, 'Serbian Dinar' name, 'Дин.' symbol FROM dual UNION ALL
    SELECT 'RUB' id, 'Russian Ruble' name, '₽' symbol FROM dual UNION ALL
    SELECT 'RWF' id, 'Rwandan Franc' name, 'FRw' symbol FROM dual UNION ALL
    SELECT 'SAR' id, 'Saudi Riyal' name, 'ر.س' symbol FROM dual UNION ALL
    SELECT 'SBD' id, 'Solomon Islands Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'SCR' id, 'Seychellois Rupee' name, '₨' symbol FROM dual UNION ALL
    SELECT 'SDG' id, 'Sudanese Pound' name, 'ج.س' symbol FROM dual UNION ALL
    SELECT 'SEK' id, 'Swedish Krona' name, 'kr' symbol FROM dual UNION ALL
    SELECT 'SGD' id, 'Singapore Dollar' name, 'S$' symbol FROM dual UNION ALL
    SELECT 'SHP' id, 'Saint Helenian Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'SLL' id, 'Sierra Leonean Leone' name, 'Le' symbol FROM dual UNION ALL
    SELECT 'SOS' id, 'Somali Shilling' name, 'Sh' symbol FROM dual UNION ALL
    SELECT 'SRD' id, 'Surinamese Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'SSP' id, 'South Sudanese Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'STN' id, 'São Tomé and Príncipe Dobra' name, 'Db' symbol FROM dual UNION ALL
    SELECT 'SYP' id, 'Syrian Pound' name, '£' symbol FROM dual UNION ALL
    SELECT 'SZL' id, 'Swazi Lilangeni' name, 'L' symbol FROM dual UNION ALL
    SELECT 'THB' id, 'Thai Baht' name, '฿' symbol FROM dual UNION ALL
    SELECT 'TJS' id, 'Tajikistani Somoni' name, 'ЅМ' symbol FROM dual UNION ALL
    SELECT 'TMT' id, 'Turkmenistani Manat' name, 'm' symbol FROM dual UNION ALL
    SELECT 'TND' id, 'Tunisian Dinar' name, 'د.ت' symbol FROM dual UNION ALL
    SELECT 'TOP' id, 'Tongan Paanga' name, 'T$' symbol FROM dual UNION ALL
    SELECT 'TRY' id, 'Turkish Lira' name, '₺' symbol FROM dual UNION ALL
    SELECT 'TTD' id, 'Trinidad and Tobago Dollar' name, 'TT$' symbol FROM dual UNION ALL
    SELECT 'TWD' id, 'New Taiwan Dollar' name, 'NT$' symbol FROM dual UNION ALL
    SELECT 'TZS' id, 'Tanzanian Shilling' name, 'TSh' symbol FROM dual UNION ALL
    SELECT 'UAH' id, 'Ukrainian Hryvnia' name, '₴' symbol FROM dual UNION ALL
    SELECT 'UGX' id, 'Ugandan Shilling' name, 'USh' symbol FROM dual UNION ALL
    SELECT 'USD' id, 'United States Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'USN' id, 'United States Dollar (Next day)' name, '$' symbol FROM dual UNION ALL
    SELECT 'UYI' id, 'Uruguayan Peso en Unidades Indexadas' name, 'UYI' symbol FROM dual UNION ALL
    SELECT 'UYU' id, 'Uruguayan Peso' name, '$U' symbol FROM dual UNION ALL
    SELECT 'UZS' id, 'Uzbekistan Som' name, 'soʻm' symbol FROM dual UNION ALL
    SELECT 'VEF' id, 'Venezuelan Bolívar Fuerte' name, 'Bs' symbol FROM dual UNION ALL
    SELECT 'VES' id, 'Venezuelan Bolívar Soberano' name, 'Bs.' symbol FROM dual UNION ALL
    SELECT 'VND' id, 'Vietnamese Dong' name, '₫' symbol FROM dual UNION ALL
    SELECT 'VUV' id, 'Vanuatu Vatu' name, 'VT' symbol FROM dual UNION ALL
    SELECT 'WST' id, 'Samoan Tala' name, 'T' symbol FROM dual UNION ALL
    SELECT 'XAF' id, 'CFA Franc BEAC' name, 'FCFA' symbol FROM dual UNION ALL
    SELECT 'XAG' id, 'Silver (one troy ounce)' name, 'XAG' symbol FROM dual UNION ALL
    SELECT 'XAU' id, 'Gold (one troy ounce)' name, 'XAU' symbol FROM dual UNION ALL
    SELECT 'XBA' id, 'European Composite Unit Bond' name, 'XBA' symbol FROM dual UNION ALL
    SELECT 'XBB' id, 'European Monetary Unit Bond' name, 'XBB' symbol FROM dual UNION ALL
    SELECT 'XBC' id, 'European Unit of Account 9 (E.U.A.-9)' name, 'XBC' symbol FROM dual UNION ALL
    SELECT 'XBD' id, 'European Unit of Account 17 (E.U.A.-17)' name, 'XBD' symbol FROM dual UNION ALL
    SELECT 'XCD' id, 'East Caribbean Dollar' name, '$' symbol FROM dual UNION ALL
    SELECT 'XDR' id, 'SDR (Special Drawing Right)' name, 'XDR' symbol FROM dual UNION ALL
    SELECT 'XOF' id, 'CFA Franc BCEAO' name, 'CFA' symbol FROM dual UNION ALL
    SELECT 'XPD' id, 'Palladium (one troy ounce)' name, 'XPD' symbol FROM dual UNION ALL
    SELECT 'XPF' id, 'CFP Franc' name, 'Fr' symbol FROM dual UNION ALL
    SELECT 'XPT' id, 'Platinum (one troy ounce)' name, 'XPT' symbol FROM dual UNION ALL
    SELECT 'XSU' id, 'Sucre' name, 'XSU' symbol FROM dual UNION ALL
    SELECT 'XTS' id, 'Code reserved for testing' name, 'XTS' symbol FROM dual UNION ALL
    SELECT 'XUA' id, 'ADB Unit of Account' name, 'XUA' symbol FROM dual UNION ALL
    SELECT 'XXX' id, 'No currency' name, 'XXX' symbol FROM dual UNION ALL
    SELECT 'YER' id, 'Yemeni Rial' name, '﷼' symbol FROM dual UNION ALL
    SELECT 'ZAR' id, 'South African Rand' name, 'R' symbol FROM dual UNION ALL
    SELECT 'ZMW' id, 'Zambian Kwacha' name, 'ZK' symbol FROM dual UNION ALL
    SELECT 'ZWL' id, 'Zimbabwean Dollar' name, 'Z$' symbol FROM dual
) src
ON (tgt.id = src.id)
WHEN NOT MATCHED THEN
    INSERT (id, name, symbol, active)
    VALUES (src.id, src.name, src.symbol, 'Y')
WHEN MATCHED THEN
    UPDATE SET
        tgt.name = src.name,
        tgt.symbol = src.symbol;
