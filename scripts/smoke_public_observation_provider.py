from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=(root/'server/providers/kmaNowcast.ts').read_text()
for token in ['getUltraSrtNcst','41430','47190','45190','RN1','official_data: true']:
    assert token in text, token
print('PASS public observation provider')
