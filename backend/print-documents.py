from flask import Flask, request
from flask_cors import CORS
from zebra import Zebra
import cups

app = Flask(__name__)
CORS(app)
zebra = Zebra()
cableZebra = Zebra()
zebra.setqueue('ZTC-ZT230-200dpi-ZPL')
cableZebra.setqueue('ZTC-ZT231-203dpi-ZPL')

@app.route('/print-label/', methods=['GET', 'POST'])
def print_labels():
    dueDate = request.args.get('due_date')
    calibrationDate = request.args.get('calibration_date')
    certificateNumber = request.args.get('certificate_number')
    sensorId = request.args.get('sensor_id')
    cableId = request.args.get('cable_id')

    if cableId:
        label = f'^XA^CF0,14,15^FO8,10^FDsensorcalibrations.com^FS^FO8,28^FDCERT#:^FS^FO63,28^FD{certificateNumber}^FS^FO8,46^FDDate:^FS^FO63,46^FD{calibrationDate}^FS^FO8,64^FDExp:^FS^FO63,64^FD{dueDate}^FS^FO8,82^FDDev:^FS^FO63,82^FD{cableId}^FS^FO295,10^FDsensorcalibrations.com^FS^FO295,28^FDCERT#:^FS^FO350,28^FD{certificateNumber}^FS^FO295,46^FDDate:^FS^FO350,46^FD{calibrationDate}^FS^FO295,64^FDExp:^FS^FO350,64^FD{dueDate}^FS^FO295,82^FDDev:^FS^FO350,82^FD{cableId}^FS^PQ1,0,1,Y^XZ'
        cableZebra.output(label)
    else:
        label = f'^XA^FS^CF0,17,19^FO8,12^FDsensorcalibrations.com^FS^CF0,17,18^FO8,30^FDCERT#:^FS^FO63,30^FD{certificateNumber}^FS^FO8,48^FDDate:^FS^FO63,48^FD{calibrationDate}^FS^FO8,66^FDExp:^FS^FO63,66^FD{dueDate}^FS^FO8,84^FDDev:^FS^FO63,84^FD{sensorId}^FS^PQ1,0,1,Y^XZ'
        zebra.output(label)

    return 'Printed label successfully'

@app.route('/print-pdf/', methods=['GET', 'POST'])
def test():
    data = request.data
    with open('/home/technician/recentPdf.pdf', 'wb') as file:
        file.write(data)

    conn = cups.Connection()
    printerName = 'HP-ColorLaserJet-M255-M256'
    job_id = conn.createJob(printerName, 'Print PDF Job', {})
    conn.printFile(printerName, '/home/technician/recentPdf.pdf', '/home/technician/recentPdf.pdf', {})
    conn.cancelJob(job_id)
    return 'Printed PDF successfully'

if __name__ == '__main__':
    app.run(host='localhost', port=8000)