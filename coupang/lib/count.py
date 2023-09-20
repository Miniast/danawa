import pandas as pd

# df = pd.read_csv('products.csv', dtype=str)
# df.drop_duplicates(subset=['id'], inplace=True)
# df = df[~df['name'].str.startswith(('1824', '1834'))]
df = pd.read_csv('../test/1.csv', dtype=str, header=None)
