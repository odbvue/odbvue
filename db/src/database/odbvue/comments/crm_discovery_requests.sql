COMMENT ON TABLE odbvue.crm_discovery_requests IS
    'Table to store CRM discovery requests from potential clients';

COMMENT ON COLUMN odbvue.crm_discovery_requests.created IS
    'Timestamp when the request was created';

COMMENT ON COLUMN odbvue.crm_discovery_requests.email IS
    'Email address of the requester';

COMMENT ON COLUMN odbvue.crm_discovery_requests.message IS
    'Additional message from the requester';

COMMENT ON COLUMN odbvue.crm_discovery_requests.name IS
    'Full name of the requester';

COMMENT ON COLUMN odbvue.crm_discovery_requests.organization IS
    'Organization name of the requester';

COMMENT ON COLUMN odbvue.crm_discovery_requests.phone IS
    'Phone number of the requester';


-- sqlcl_snapshot {"hash":"140279f5e56e7b6beb9b2fbb02c70557a81c2b43","type":"COMMENT","name":"crm_discovery_requests","schemaName":"odbvue","sxml":""}