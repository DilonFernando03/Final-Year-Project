import json
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

openf1_api_url = 'https://api.openf1.org/v1/meetings?year=2024'

# Function to fetch data from a given API URL
def fetch_data(api_url):
    try:
        response = urlopen(api_url)
        data = response.read().decode('utf-8')

        # Try to parse it as JSON
        json_data = json.loads(data)
        counter = 0
        # Iterate over each lap in the json_data and print lap_number
        if isinstance(json_data, list):
            for lap in json_data:
                counter += 1
                meetingKey = lap.get("meeting_key")
                country = lap.get('country_name')
                official_name = lap.get('meeting_official_name')
                if official_name is not None:
                    print(f"Race Weekend: {meetingKey} : {country} - {official_name}")
                #else:
                    print("Drivers not found")
        else:
            print("Unexpected data format. Expected a list of laps.")
        print(counter)
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
