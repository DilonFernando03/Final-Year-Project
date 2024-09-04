import json
from urllib.request import urlopen

# Fetch data from the API
response = urlopen('https://api.openf1.org/v1/Position?driver_number=55&date=2024-03-02')
test = urlopen('https://api.openf1.org/v1/Laps?meeting_key=1229&session_key=9472&driver_number=55')

# Decode the response and convert JSON to Python objects
data = json.loads(response.read().decode('utf-8'))
test_Data = json.loads(test.read().decode('utf-8'))

# Loop through each lap in the test_Data and print the lap duration
for lap in test_Data:
    print(lap['lap_number'])
