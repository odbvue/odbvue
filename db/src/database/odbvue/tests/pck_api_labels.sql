BEGIN
    
    -- Numeric
    
    pck_api_labels.link_label_nm('Important', 'document', 123);
    pck_api_labels.link_label_nm('Important', 'document', 234);
    pck_api_labels.link_label_nm('Important', 'document', 345);
    pck_api_labels.link_label_nm('Nice to have', 'document', 456);
    pck_api_labels.link_label_nm('Nice to have', 'document', 567);

    pck_api_labels.unlink_label_nm('Important', 'document', 234);
    pck_api_labels.unlink_label_nm('Important', 'document', 678); -- non-existing link

    -- Variable Character

    pck_api_labels.link_label_vc('Important', 'folder', 'abc123');
    pck_api_labels.link_label_vc('Important', 'folder', 'def456');
    pck_api_labels.link_label_vc('Important', 'folder', 'ghi789');
    pck_api_labels.link_label_vc('Nice to have', 'folder', 'jkl012');
    pck_api_labels.link_label_vc('Nice to have', 'folder', 'mno345');

    pck_api_labels.unlink_label_vc('Important', 'folder', 'def456');
    pck_api_labels.unlink_label_vc('Important', 'folder', 'xyz999'); -- non-existing link

    -- done

    COMMIT;
END;
/

SELECT 
    ll.entity_name, 
    COALESCE(ll.entity_id_vc, TO_CHAR(ll.entity_id_nm)) AS entity_id, 
    l.name AS label_name
FROM label_links ll 
JOIN labels l ON ll.label_id = l.id
ORDER BY ll.entity_name, l.code;