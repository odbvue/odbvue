
DECLARE
  v_pdf_blob blob;
BEGIN
  -- Initialize PDF
  pck_api_pdf.init();
  
  -- Set document info
  pck_api_pdf.set_info(
    p_title => 'Simple PDF Example',
    p_author => 'PL/SQL',
    p_subject => 'Basic PDF Generation'
  );
  
  -- Add first page
  pck_api_pdf.new_page();
  
  -- Write title
  pck_api_pdf.set_font(p_family => 'helvetica', p_style => 'B', p_fontsize_pt => 24);
  pck_api_pdf.insert_txt(
    p_x => 50,
    p_y => 750,
    p_txt => 'Simple PDF Example',
    p_fontsize => 24,
    p_color => '0000FF'
  );
  
  -- Write paragraph
  pck_api_pdf.set_font(p_family => 'helvetica', p_style => 'N', p_fontsize_pt => 12);
  pck_api_pdf.multi_cell(
    p_txt => 'This is a simple example of PDF generation using the pck_api_pdf package. ' ||
             'This paragraph demonstrates basic text output in a PDF document. ' ||
             'The PDF library supports various fonts, sizes, colors, and formatting options.',
    p_x => 50,
    p_y => 700,
    p_width => 300,
    p_fontsize => 12,
    p_txt_color => '000000'
  );
  
  -- Generate PDF
  v_pdf_blob := pck_api_pdf.finish_pdf();
  
    -- Display info
  dbms_output.put_line('PDF generated successfully!');
  dbms_output.put_line('Size: ' || dbms_lob.getlength(v_pdf_blob) || ' bytes');
  dbms_output.put_line(pck_api_lob.blob_to_base64(v_pdf_blob));

EXCEPTION WHEN OTHERS THEN
  dbms_output.put_line('Error: ' || sqlerrm);
END;
/