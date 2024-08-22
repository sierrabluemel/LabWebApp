from flask import Flask, request
from flask_cors import CORS
from zebra import Zebra
import cups
import os

app = Flask(__name__)
CORS(app)
z = Zebra()
z.setqueue('ZTC-ZT230-200dpi-ZPL')
print('Starting ssh')
command_string = 'autossh -M 20000 -R 4000:localhost:8000 -i "brandtw_monnit_prod.pem" ubuntu@ec2-3-134-9-110.us-east-2.compute.amazonaws.com'
os.system(f"gnome-terminal -e '{command_string}'")
print('ssh successful')

@app.route('/print-label/', methods=['GET', 'POST'])
def print_labels():
    dueDate = request.args.get('due_date')
    calibrationDate = request.args.get('calibration_date')
    certificateNumber = request.args.get('certificate_number')
    sensorId = request.args.get('sensor_id')
    label = f'^XA^FS^CF0,17,19^FO8,12^FDsensorcalibrations.com^FS^CF0,17,18^FO8,30^FDCERT#:^FS^FO63,30^FD{certificateNumber}^FS^FO8,48^FDDate:^FS^FO63,48^FD{calibrationDate}^FS^FO8,66^FDExp:^FS^FO63,66^FD{dueDate}^FS^FO8,84^FDDev:^FS^FO63,84^FD{sensorId}^FS^PQ1,0,1,Y^XZ'
    
    z.output(label)
    return 'Printed label successfully'

@app.route('/print-pdf/', methods=['GET', 'POST'])
def test():
    data = request.data
    with open('recentPdf.pdf', 'wb') as file:
        file.write(data)

    conn = cups.Connection()
    printerName = 'HP-ColorLaserJet-M255-M256'
    job_id = conn.createJob(printerName, 'Print PDF Job', {})
    conn.printFile(printerName, 'recentPdf.pdf', 'recentPdf.pdf', {})
    conn.cancelJob(job_id)
    return 'Printed PDF successfully'

if __name__ == '__main__':
    app.run(host='localhost', port=8000)