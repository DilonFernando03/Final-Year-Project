import json
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

openf1_api_url = 'https://api.openf1.org/v1/Laps?meeting_key=1143&session_key=7787&driver_number=1'

# Function to fetch data from a given API URL
def fetch_data(api_url):
    try:
        response = urlopen(api_url)
        data = response.read().decode('utf-8')

        # Try to parse it as JSON
        json_data = json.loads(data)

        # Iterate over each lap in the json_data and print lap_number
        if isinstance(json_data, list):
            for lap in json_data:
                lap_number = lap.get('lap_number')
                lap_time = lap.get('lap_duration')
                if lap_number is not None:
                    print(f"Lap Number: {lap_number}, Time: {lap_time}")
                else:
                    print("Lap number not found for one of the laps.")
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
