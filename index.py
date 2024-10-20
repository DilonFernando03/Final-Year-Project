import json
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

openf1_api_url = 'https://api.openf1.org/v1/weather?meeting_key=1143&session_key=7787'

# Function to fetch data from a given API URL
def fetch_data(api_url):
    try:
        response = urlopen(api_url)
        data = response.read().decode('utf-8')

        # Try to parse it as JSON
        json_data = json.loads(data)
        print(json_data[1])
        # Iterate over each lap in the json_data and print lap_number
        if isinstance(json_data, list):
            for lap in json_data:
                interval = lap.get('interval')
                driver_number = lap.get('driver_number')
                #if driver_number is not None:
                    #print(f"Driver Number: {driver_number} - {interval}")
                #else:
                    #print("Drivers not found")
        else:
            print("Unexpected data format. Expected a list of laps.")
        
        return json_data

    except HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
    except URLError as e:
        print(f"URL Error: {e.reason}")
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    return None

fetch_data(openf1_api_url)
