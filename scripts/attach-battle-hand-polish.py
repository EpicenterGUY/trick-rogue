from pathlib import Path

path=Path('index.html')
text=path.read_text(encoding='utf-8')
css='<link rel="stylesheet" href="battle-hand-polish.css">'
js='<script src="battle-hand-polish.js"></script>'

if css not in text:
    if '</head>' not in text: raise SystemExit('missing </head>')
    text=text.replace('</head>',css+'\n</head>',1)
if js not in text:
    marker='renderStart();\n</script>\n</body>'
    if marker not in text: raise SystemExit('missing final script marker')
    text=text.replace(marker,'renderStart();\n</script>\n'+js+'\n</body>',1)
path.write_text(text,encoding='utf-8')
print('attached battle-hand-polish modules')
