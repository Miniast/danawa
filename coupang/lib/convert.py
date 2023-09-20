import pandas as pd

pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', 50)
pd.set_option('display.width', 1000)
pd.set_option('display.max_colwidth', None)
pd.set_option('display.min_rows', 50)

# df = pd.DataFrame(columns=['fullCate', 'alterCate', 'totalProducts'])
# with open('../result/total.csv') as file:
#     lines = file.readlines()
#     for line in lines:
#         line = line.strip().split(',')
#         if len(line) == 4:
#             line[2] = str(line[2]) + str(line[3])
#             line.pop()
#         df.loc[len(df)] = line
# # df.columns = ['fullCate', 'alterCate', 'totalProducts']
# df.to_csv('totalRaw.csv', index=False, encoding='utf-8-sig')
df = pd.read_csv('../archived/totalRaw.csv', dtype={
    'fullCate': str,
    'alterCate': str,
    'totalProducts': int
})
df.sort_values(by=['totalProducts'], inplace=True, ascending=False)
df = df[~df['fullCate'].str.startswith(('1824', '1834'))]
