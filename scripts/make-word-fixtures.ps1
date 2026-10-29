# Loob SÜNTEETILISED Wordi testfailid (fiktiivne klient): order-a.docx ja order-a.doc (Word 97-2003).
# Vajab paigaldatud Microsoft Wordi. Käivita: powershell -File scripts/make-word-fixtures.ps1
$out = Join-Path (Get-Location) "test\fixtures"
New-Item -ItemType Directory -Force $out | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Add()
  $sel = $word.Selection
  $sel.TypeText("TELLIMUS nr N-2027-001 (naidis, fiktiivne)"); $sel.TypeParagraph()
  $sel.TypeText("Klient: Näidis Merekeskus OÜ (fiktiivne)"); $sel.TypeParagraph()
  $sel.TypeText("Projekt: Näidis Sadam 2027"); $sel.TypeParagraph()
  $sel.TypeText("Soovitud tarne: 15.05.2027"); $sel.TypeParagraph()
  $tbl = $doc.Tables.Add($sel.Range, 2, 7)
  $head = @("Toote kood","Nimetus","Variant","Kogus","Laius (m)","Pikkus (m)","Ujukeid mooduli kohta")
  $row = @("02 12 04","SP ponton 2,4 x 4 m","moodul","2","2,4","4","4")
  for ($i = 0; $i -lt 7; $i++) { $tbl.Cell(1, $i + 1).Range.Text = $head[$i]; $tbl.Cell(2, $i + 1).Range.Text = $row[$i] }
  $sel.EndKey(6) | Out-Null
  $sel.TypeParagraph()
  $sel.TypeText("Ankurdus: ketiankur 13 mm, 2 tk"); $sel.TypeParagraph()
  $sel.TypeText("Kaldaühendust ei ole. Moodulid paigaldatakse eraldi.")
  $doc.SaveAs2([ref](Join-Path $out "order-a.docx"), [ref]16)
  $doc.SaveAs2([ref](Join-Path $out "order-a.doc"), [ref]0)
  $doc.Close([ref]0)
} finally {
  $word.Quit()
}
"valmis"
