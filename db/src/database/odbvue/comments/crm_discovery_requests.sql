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
    'Phone number provided by the lead.';


-- sqlcl_snapshot {"hash":"56707bf14787a850d9294ecc285641a5d87f270c","type":"COMMENT","name":"crm_discovery_requests","schemaName":"odbvue","sxml":""}